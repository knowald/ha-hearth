"""split.py"""

import sys
import json
import os
import re

OUTPUT_PATH = sys.argv[1]
translations = json.load(sys.stdin)

# Hearth's own copy lives in static/translations/hearth/ and is never
# generated; only plain <locale>.json files are written here
LOCALE = re.compile(r"^[a-z]{2,3}(-[A-Za-z0-9]+)*$")

for language_code in translations:
    if not LOCALE.match(language_code):
        sys.exit(f"refusing to write unexpected locale {language_code!r}")

for language_code, translation_data in translations.items():
    output_file_path = os.path.join(OUTPUT_PATH, f"{language_code}.json")

    with open(output_file_path, "w", encoding="utf-8") as output_file:
        json.dump(translation_data, output_file, indent="\t")
        output_file.write("\n")
