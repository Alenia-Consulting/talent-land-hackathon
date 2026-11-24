# Debian, not Alpine: opencv, numpy and imageio-ffmpeg ship glibc wheels that musl cannot install.
FROM python:3.13-slim

# opencv-python loads libGL and libglib when imported, and the slim image ships neither.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./

COPY docker/backend/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
