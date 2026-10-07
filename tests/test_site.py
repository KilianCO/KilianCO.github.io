"""Vérifie que le site se construit et qu'aucun lien interne n'est cassé."""
from html.parser import HTMLParser
from pathlib import Path

import pytest

import build


class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ("href", "src", "data-model-url") and value:
                self.links.append(value)


@pytest.fixture(scope="module")
def site(tmp_path_factory):
    return build.build(tmp_path_factory.mktemp("dist"))


def test_pages_exist(site: Path):
    assert (site / "index.html").exists()
    assert (site / "404.html").exists()
    assert list((site / "projets").glob("*/index.html")), "aucune page projet générée"


def test_internal_links_resolve(site: Path):
    import yaml
    base = yaml.safe_load((build.CONTENT / "site.yaml").read_text(encoding="utf-8")).get("base_path", "").rstrip("/")
    broken = []
    for page in site.rglob("*.html"):
        parser = LinkCollector()
        parser.feed(page.read_text(encoding="utf-8"))
        for link in parser.links:
            if not link.startswith("/") or link.startswith("//"):
                continue  # liens externes, ancres, mailto
            path = link.split("#")[0].split("?")[0]
            if base and path.startswith(base):
                path = path[len(base):]
            target = site / path.lstrip("/")
            if path.endswith("/") or target.is_dir():
                target = target / "index.html"
            if not target.exists():
                broken.append(f"{page.relative_to(site)} -> {link}")
    assert not broken, "liens cassés :\n" + "\n".join(broken)
