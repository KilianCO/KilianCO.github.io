"""Générateur statique du site.

    python build.py            # construit le site dans dist/
    python build.py --serve    # construit puis sert dist/ sur http://localhost:8000

Contenu : content/site.yaml (profil) et content/projets/*.md (une page par projet).
Mise en page : templates/ (Jinja2). Fichiers statiques : static/.
"""
from __future__ import annotations

import argparse
import datetime as dt
import http.server
import shutil
import socketserver
from functools import partial
from pathlib import Path

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined

ROOT = Path(__file__).parent
CONTENT = ROOT / "content"
TEMPLATES = ROOT / "templates"
STATIC = ROOT / "static"


def read_project(path: Path) -> dict:
    """Lit un fichier Markdown avec un en-tête YAML délimité par ---."""
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        raise ValueError(f"{path.name} : en-tête YAML manquant")
    _, front, body = text.split("---", 2)
    meta = yaml.safe_load(front) or {}
    for key in ("title", "summary", "status"):
        if key not in meta:
            raise ValueError(f"{path.name} : champ « {key} » manquant")
    meta["slug"] = path.stem
    meta["body"] = markdown.markdown(body, extensions=["extra", "sane_lists"])
    meta.setdefault("demo", {}).setdefault("type", "")
    meta.setdefault("stack", [])
    meta.setdefault("code", "")
    return meta


def build(out: Path) -> Path:
    site = yaml.safe_load((CONTENT / "site.yaml").read_text(encoding="utf-8"))
    base = site.get("base_path", "").rstrip("/")
    projects = sorted(
        (read_project(p) for p in (CONTENT / "projets").glob("*.md")),
        key=lambda p: p.get("order", 99),
    )

    def url(path: str) -> str:
        """Préfixe les chemins internes par base_path (utile si le site vit dans un sous-dossier)."""
        if path.startswith(("http://", "https://", "mailto:", "#")):
            return path
        return f"{base}{path}"

    env = Environment(
        loader=FileSystemLoader(TEMPLATES),
        autoescape=True,
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.globals.update(site=site, projects=projects, url=url, year=dt.date.today().year)

    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(STATIC, out)

    pages = {"index.html": ("index.html", {"page_path": "/"})}
    for p in projects:
        pages[f"projets/{p['slug']}/index.html"] = (
            "projet.html",
            {"project": p, "page_path": f"/projets/{p['slug']}/"},
        )
    pages["404.html"] = ("404.html", {"page_path": "/404.html"})

    for dest, (template, ctx) in pages.items():
        target = out / dest
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(env.get_template(template).render(**ctx), encoding="utf-8")

    # Référencement
    site_url = site["url"].rstrip("/") + base
    locs = ["/"] + [f"/projets/{p['slug']}/" for p in projects]
    (out / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{site_url}{loc}</loc></url>\n" for loc in locs)
        + "</urlset>\n",
        encoding="utf-8",
    )
    (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {site_url}/sitemap.xml\n")
    (out / ".nojekyll").write_text("")  # GitHub Pages : servir les fichiers tels quels
    return out


def serve(directory: Path, port: int = 8000) -> None:
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Site disponible sur http://localhost:{port}")
        httpd.serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default="dist", help="dossier de sortie (défaut : dist)")
    parser.add_argument("--serve", action="store_true", help="servir le site après la construction")
    args = parser.parse_args()
    out = build(ROOT / args.out)
    print(f"Site construit dans {out}")
    if args.serve:
        serve(out)
