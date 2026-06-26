#!/usr/bin/env python3
# uv init arxiv-weekly
# cd arxiv-weekly
# uv add feedparser
#
#uv run python arxiv_weekly.py --days 7 --max-results 100 --output arxiv-weekly.md
#

import argparse
import datetime as dt
from pathlib import Path
import feedparser
import textwrap
import urllib.parse
import urllib.request
from email.utils import parsedate_to_datetime

ARXIV_API = "https://export.arxiv.org/api/query"

CATEGORIES = {
    "cs.HC": "Human-Computer Interaction",
    "eess.AS": "Sound / Audio and Speech Processing",
    "cs.PL": "Programming Languages",
    "cs.AR": "Hardware Architecture",
    "cs.RO": "Robotics",
    "eess.SP": "Signal Processing",
    "cs.AI": "Artificial Intelligence",
    "cs.CV": "Computer Vision and Pattern Recognition",
    "cs.CY": "Computers and Society",
}


def fetch_category(category, max_results=50):
    params = {
        "search_query": f"cat:{category}",
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }

    url = ARXIV_API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url) as response:
        return feedparser.parse(response.read())


def clean(text):
    return " ".join(text.replace("\n", " ").split())


def paper_url(entry):
    return entry.get("link", "")


def pdf_url(entry):
    for link in entry.get("links", []):
        if link.get("type") == "application/pdf":
            return link.get("href")
    return paper_url(entry).replace("/abs/", "/pdf/")


def get_papers_for_week(category, days=7, max_results=50):
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    feed = fetch_category(category, max_results=max_results)

    papers = []
    for entry in feed.entries:
        published = dt.datetime(
            *entry.published_parsed[:6],
            tzinfo=dt.timezone.utc,
        ) 

        if published < cutoff:
            continue

        papers.append({
            "title": clean(entry.title),
            "authors": [a.name for a in entry.authors],
            "published": published.date().isoformat(),
            "summary": clean(entry.summary),
            "url": paper_url(entry),
            "pdf": pdf_url(entry),
            "primary_category": entry.arxiv_primary_category["term"],
            "categories": [tag["term"] for tag in entry.tags],
        })

    return papers


def write_markdown(results, output_path, days):
    today = dt.datetime.now().date().isoformat()

    lines = [
        f"# arXiv Weekly Digest",
        "",
        f"Generated: {today}",
        f"Window: past {days} days",
        "",
    ]

    for category, label in CATEGORIES.items():
        papers = results[category]

        lines += [
            f"## {label} ({category})",
            "",
            f"{len(papers)} paper(s) found.",
            "",
        ]

        for i, paper in enumerate(papers, 1):
            authors = ", ".join(paper["authors"][:8])
            if len(paper["authors"]) > 8:
                authors += ", et al."

            summary = textwrap.shorten(paper["summary"], width=700, placeholder="…")

            lines += [
                f"### {i}. {paper['title']}",
                "",
                f"- **Authors:** {authors}",
                f"- **Published:** {paper['published']}",
                f"- **Primary category:** {paper['primary_category']}",
                f"- **All categories:** {', '.join(paper['categories'])}",
                f"- **Abstract:** {summary}",
                f"- **Links:** [Abstract]({paper['url']}) · [PDF]({paper['pdf']})",
                "",
            ]

    output_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(
        description="Fetch recent arXiv papers from selected categories."
    )
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--max-results", type=int, default=75)
    parser.add_argument("--output", default="arxiv-weekly.md")
    args = parser.parse_args()

    results = {}

    for category, label in CATEGORIES.items():
        print(f"Fetching {category}: {label}")
        results[category] = get_papers_for_week(
            category,
            days=args.days,
            max_results=args.max_results,
        )

    write_markdown(results, Path(args.output), args.days)
    print(f"\nWrote {args.output}")


if __name__ == "__main__":
    main()
