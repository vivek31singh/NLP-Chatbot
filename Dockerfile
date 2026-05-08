FROM rasa/rasa:3.10.9-full

WORKDIR /app
COPY --chown=1000:1000 . .
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || true

EXPOSE 5005
CMD ["rasa", "run", "--enable-api", "--cors", "*"]
