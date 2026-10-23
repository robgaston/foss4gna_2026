"""Generates the QR codes on the "Come build with us" slide.

    ~/Projects/arches4/foss4gna_demo_env/bin/python scripts/generate-qr-codes.py

Needs the `qrcode` package (installed in the demo venv).
"""

from pathlib import Path

import qrcode
import qrcode.image.svg

QR_CODE_TARGETS = {
    "qr-slides.svg": "https://rgaston.com/foss4gna_2026/",
    "qr-arches-github.svg": "https://github.com/archesproject/arches",
    "qr-archesproject.svg": "https://www.archesproject.org/",
}

output_directory = Path(__file__).resolve().parent.parent / "assets" / "qr"
output_directory.mkdir(parents=True, exist_ok=True)

for file_name, url in QR_CODE_TARGETS.items():
    qr_code = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        border=2,
        image_factory=qrcode.image.svg.SvgPathFillImage,
    )
    qr_code.add_data(url)
    qr_code.make(fit=True)
    qr_code.make_image().save(output_directory / file_name)
    print(f"{file_name}: {url}")
