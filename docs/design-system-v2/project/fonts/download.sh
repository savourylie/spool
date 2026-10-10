#!/usr/bin/env bash
# Download the Outfit and Plus Jakarta Sans WOFF2 font files into ./fonts/
# After running this, the @font-face declarations in colors_and_type.css
# (with the matching commented `src: url("fonts/...")` entries) will load
# from disk instead of from fonts.gstatic.com.

set -euo pipefail
cd "$(dirname "$0")"

curl_quiet() { curl -sSfL --output-dir . -o "$2" "$1"; }

# Outfit
curl_quiet "https://fonts.gstatic.com/s/outfit/v11/QGYvz_MVcBeNP4NjuGObqx1XmO1I4TC1O4a0Eg.woff2"  "Outfit-700.woff2"
curl_quiet "https://fonts.gstatic.com/s/outfit/v11/QGYvz_MVcBeNP4NjuGObqx1XmO1I4TC1O4a0Eg.woff2"  "Outfit-800.woff2"

# Plus Jakarta Sans
curl_quiet "https://fonts.gstatic.com/s/plusjakartasans/v9/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU79TQ.woff2"  "PlusJakartaSans-400.woff2"
curl_quiet "https://fonts.gstatic.com/s/plusjakartasans/v9/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU79TQ.woff2"  "PlusJakartaSans-500.woff2"
curl_quiet "https://fonts.gstatic.com/s/plusjakartasans/v9/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU79TQ.woff2"  "PlusJakartaSans-600.woff2"
curl_quiet "https://fonts.gstatic.com/s/plusjakartasans/v9/LDIbaomQNQcsA88c7O9yZ4KMCoOg4IA6-91aHEjcWuA_qU79TQ.woff2"  "PlusJakartaSans-700.woff2"

echo "Done — fonts downloaded into $(pwd)"
echo "To use them, uncomment the local-file 'src' lines in colors_and_type.css."
