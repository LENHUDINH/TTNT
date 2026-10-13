"""Transfer only FinSight's database; preserve source volume and unrelated XAMPP databases.

Run after stopping the FinSight backend to prevent writes during cutover.
Credentials and raw SQL backups are kept only in ignored, owner-readable files.
"""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import subprocess, json, hashlib, os, re, argparse

ROOT=Path(__file__).resolve().parents[1]
MYSQL=Path('/Applications/XAMPP/xamppfiles/bin/mysql')
ROOT_SOCKET='/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock'
COMPOSE=['sh',str(ROOT/'scripts/compose.sh'),'--profile','legacy-db']
TARGET_USER='finsight_xampp'
TABLES=['users','wallets','categories','transactions','transfers','budgets','savings_goals','savings_contributions','ai_predictions','anomaly_alerts','model_versions','notifications','audit_logs','recurring_transactions','password_resets','classification_feedback','flyway_schema_history']

def target(sql,database=None):
    args=[str(MYSQL),'--no-defaults','--protocol=SOCKET','--socket='+ROOT_SOCKET,'-u','root','--default-character-set=utf8mb4','--batch','--raw','--skip-column-names']
    if database:args.append(database)
    return subprocess.check_output(args,input=("SET time_zone='+00:00';"+sql).encode(),cwd=ROOT).decode()

def source(sql):
    return subprocess.check_output(COMPOSE+['exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u "$MYSQL_USER" --batch --raw --skip-column-names --default-character-set=utf8mb4 finsight'],input=("SET time_zone='+00:00';"+sql).encode(),cwd=ROOT).decode()

def quote(value):return "'"+value.replace('\\','\\\\').replace("'","''")+"'"

def counts(run):return {t:int(run(f'SELECT COUNT(*) FROM `{t}`;').strip()) for t in TABLES}
def fingerprint(run,t):
    # Hash full ordered logical rows, keeping sensitive contents out of reports.
    order='installed_rank' if t=='flyway_schema_history' else 'id'
    return hashlib.sha256(run(f'SELECT * FROM `{t}` ORDER BY `{order}`;').encode()).hexdigest()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--resume-backup',type=Path,help='Verify an already imported snapshot from this migration before switching.')
    resume=parser.parse_args().resume_backup
    if not resume and target("SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='finsight';").strip()!='0':
        raise SystemExit('Target finsight already exists; refusing to overwrite it.')
    if target("SELECT COUNT(*) FROM mysql.user WHERE User='finsight_xampp';").strip()!='0':
        raise SystemExit('Target account name already exists; refusing to alter an existing account.')
    env=ROOT/'.env';values={}
    for line in env.read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k,v=line.split('=',1);values[k]=v.strip().strip('"').strip("'")
    password=values['DB_PASSWORD']
    stamp=datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).strftime('%Y%m%d-%H%M%S')
    directory=(ROOT/resume).resolve() if resume else ROOT/'runtime/backups'/stamp
    if resume:
        if not directory.is_relative_to((ROOT/'runtime/backups').resolve()) or not (directory/'env.before').is_file() or not (directory/'finsight-mysql8.sql').is_file():
            raise SystemExit('Resume requires an existing FinSight migration backup.')
        if (directory/'env.before').read_bytes()!=env.read_bytes():
            raise SystemExit('Environment changed since backup; refusing to resume.')
    else:
        directory.mkdir(parents=True,mode=0o700)
        (directory/'env.before').write_bytes(env.read_bytes());os.chmod(directory/'env.before',0o600)
    raw=directory/'finsight-mysql8.sql';compatible=directory/'finsight-xampp.sql'
    # This snapshot is consistent and also excludes credentials outside FinSight.
    if not resume:
        with raw.open('wb') as out:
            os.chmod(raw,0o600)
            subprocess.run(COMPOSE+['exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump -u "$MYSQL_USER" --single-transaction --quick --net-buffer-length=16384 --skip-lock-tables --skip-add-locks --skip-add-drop-table --no-tablespaces --set-gtid-purged=OFF --column-statistics=0 --default-character-set=utf8mb4 --hex-blob finsight'],cwd=ROOT,stdout=out,check=True)
    data=raw.read_text();unsupported=sorted(set(re.findall(r'utf8mb4_0900_[a-z_]+',data)))
    for collation in unsupported:
        if collation!='utf8mb4_0900_ai_ci':raise SystemExit('Unexpected unsupported collation: '+collation)
        data=data.replace(collation,'utf8mb4_unicode_ci')
    compatible.write_text(data);os.chmod(compatible,0o600)
    source_counts=counts(source);source_hashes={t:fingerprint(source,t) for t in TABLES}
    if not resume:
        target('CREATE DATABASE `finsight` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
        with compatible.open('rb') as sql:
            subprocess.run([str(MYSQL),'--no-defaults','--protocol=SOCKET','--socket='+ROOT_SOCKET,'-u','root','--default-character-set=utf8mb4','--max-allowed-packet=64M','finsight'],stdin=sql,cwd=ROOT,check=True)
    destination=lambda sql:target(sql,'finsight')
    target_counts=counts(destination);target_hashes={t:fingerprint(destination,t) for t in TABLES}
    if source_counts!=target_counts or source_hashes!=target_hashes:
        raise SystemExit('Data verification failed; backend/environment have not been switched.')
    # Bridge traffic arrives as localhost through Colima. Never grant privileges on other databases.
    for host in ['localhost','127.0.0.1']:
        target(f'CREATE USER {quote(TARGET_USER)}@{quote(host)} IDENTIFIED BY {quote(password)}; GRANT ALL PRIVILEGES ON `finsight`.* TO {quote(TARGET_USER)}@{quote(host)};')
    report={'migratedAt':datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).isoformat(),'source':'Docker MySQL 8.4','targetVersion':target('SELECT VERSION();').strip(),'database':'finsight','rowCounts':target_counts,'logicalHashesMatch':True,'hashSessionTimezone':'UTC','tableHashes':target_hashes,'collationConversion':unsupported,'backupDirectory':str(directory.relative_to(ROOT)),'phpMyAdmin':'http://localhost/phpmyadmin/index.php?route=/database/structure&db=finsight'}
    (ROOT/'docs/test-results/xampp-migration.json').write_text(json.dumps(report,indent=2))
    # Update application connection only after every table has matched the snapshot.
    replacements={'LEGACY_DB_USER':values['DB_USER'],'LEGACY_DB_PASSWORD':password,'DB_USER':TARGET_USER,'DB_URL':'jdbc:mariadb://127.0.0.1:3306/finsight','CONTAINER_DB_URL':'jdbc:mariadb://host.docker.internal:3306/finsight'}
    lines=[];seen=set()
    for line in env.read_text().splitlines():
        key=line.split('=',1)[0]
        if key in replacements:lines.append(key+'='+replacements[key]);seen.add(key)
        else:lines.append(line)
    lines.extend(k+'='+v for k,v in replacements.items() if k not in seen)
    env.write_text('\n'.join(lines)+'\n');os.chmod(env,0o600)
    print(json.dumps({'database':'finsight','targetVersion':report['targetVersion'],'countsMatch':True,'hashesMatch':True,'tables':len(TABLES),'backup':report['backupDirectory']},indent=2))

if __name__=='__main__':main()
