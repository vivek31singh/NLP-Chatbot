FROM rasa/rasa:latest-full

WORKDIR /app
COPY --chown=1000:1000 docker-entrypoint.sh /docker-entrypoint.sh
COPY --chown=1000:1000 patch_regex_handler.py /app/patch_regex_handler.py
USER root
RUN chmod +x /docker-entrypoint.sh
RUN python3 /app/patch_regex_handler.py
USER 1000
COPY --chown=1000:1000 . .
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || true

EXPOSE 5005
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["run", "--enable-api", "--cors", "*", "--port", "5005"]
