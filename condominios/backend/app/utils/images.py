"""
Deteccion de tipo de imagen por firma binaria real (magic bytes).

No confiar nunca en content_type (lo controla el cliente) ni en la extension
del nombre de archivo para decidir que tipo de archivo es -- un .svg con
content-type falsificado a image/jpeg pasaria un chequeo basado en esos dos
campos y se serviria como image/svg+xml, permitiendo XSS almacenado.
"""

_IMAGE_SIGNATURES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", ".png"),
    (b"GIF87a", ".gif"),
    (b"GIF89a", ".gif"),
]


def sniff_image_ext(content: bytes) -> str | None:
    """Devuelve la extension real (.jpg/.png/.gif/.webp) o None si no es una imagen raster conocida."""
    for sig, ext in _IMAGE_SIGNATURES:
        if content.startswith(sig):
            return ext
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return ".webp"
    return None


def strip_metadata(content: bytes, ext: str) -> bytes:
    """Re-codifica la imagen sin metadata EXIF (puede traer GPS del celular que
    tomo la foto -- dato personal bajo la Ley 21.719). GIF/WebP se devuelven
    tal cual (no suelen traer EXIF de camara); JPG/PNG se re-guardan limpios.
    Si algo falla al decodificar, se devuelve el contenido original sin tocar."""
    if ext not in (".jpg", ".png"):
        return content
    try:
        from io import BytesIO
        from PIL import Image
        img = Image.open(BytesIO(content))
        img.load()
        if ext == ".jpg" and img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        out = BytesIO()
        img.save(out, format="JPEG" if ext == ".jpg" else "PNG")
        return out.getvalue()
    except Exception:
        return content
