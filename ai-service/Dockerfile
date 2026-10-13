FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY training training
COPY app/features.py app/features.py
RUN mkdir -p artifacts datasets && python -m training.train --output-dir /tmp/ai-candidate && python -m training.artifacts activate --candidate /tmp/ai-candidate --active-dir artifacts && rm -rf /tmp/ai-candidate
COPY app app
RUN useradd --system --uid 10002 finsight && chown -R finsight:finsight /app
USER 10002
EXPOSE 8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
