"""Extract a page-aware, table-aware chunk file from the accounting workbook."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

import pdfplumber


CHAPTER_RE = re.compile(r"^CHAPTER\s+([A-Z]+|\d+)\s*(.*)$", re.IGNORECASE)
EXERCISE_RE = re.compile(
    r"^(Exercise|Problem|Solved Question|Self[- ]Evaluation)\s*[:#-]?\s*([\w.\-]*)",
    re.IGNORECASE,
)
NUMBER_WORDS = {
    "ONE": 1,
    "TWO": 2,
    "THREE": 3,
    "FOUR": 4,
    "FIVE": 5,
    "SIX": 6,
    "SEVEN": 7,
    "EIGHT": 8,
    "NINE": 9,
    "TEN": 10,
}


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    lines = []
    for raw in value.replace("\u00a0", " ").splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line or re.fullmatch(r"\d+", line):
            continue
        lines.append(line)
    return "\n".join(lines)


def markdown_table(table: list[list[Any]]) -> str:
    rows = [
        [clean_text(str(cell)) if cell is not None else "" for cell in row]
        for row in table
        if any(cell not in (None, "") for cell in row)
    ]
    if not rows:
        return ""
    width = max(len(row) for row in rows)
    rows = [row + [""] * (width - len(row)) for row in rows]
    nonempty = sum(1 for row in rows for cell in row if cell)
    populated_columns = sum(
        1 for index in range(width) if sum(bool(row[index]) for row in rows) >= 2
    )
    if len(rows) < 2 or width < 2 or populated_columns < 2 or nonempty < 4:
        return ""
    header = rows[0]
    body = rows[1:]
    return "\n".join(
        [
            "| " + " | ".join(header) + " |",
            "| " + " | ".join(["---"] * width) + " |",
            *("| " + " | ".join(row) + " |" for row in body),
        ]
    )


def split_blocks(text: str, target_words: int = 500) -> list[str]:
    paragraphs = [item.strip() for item in re.split(r"\n{2,}", text) if item.strip()]
    chunks: list[str] = []
    current: list[str] = []
    count = 0
    for paragraph in paragraphs:
        words = len(paragraph.split())
        if current and count + words > target_words:
            chunks.append("\n\n".join(current))
            current = []
            count = 0
        current.append(paragraph)
        count += words
    if current:
        chunks.append("\n\n".join(current))
    return chunks


def extract(pdf_path: Path) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    chapter_number: int | None = None
    chapter_title: str | None = None
    exercise_id: str | None = None
    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            if page_number < 4:
                continue
            text = clean_text(page.extract_text(x_tolerance=2, y_tolerance=3))
            lines = text.splitlines()
            for line_index, line in enumerate(lines[:12]):
                chapter_match = CHAPTER_RE.match(line)
                if chapter_match:
                    raw_number = chapter_match.group(1).upper()
                    chapter_number = (
                        int(raw_number)
                        if raw_number.isdigit()
                        else NUMBER_WORDS.get(raw_number)
                    )
                    inline_title = chapter_match.group(2).strip()
                    following = []
                    for item in lines[line_index + 1 : line_index + 4]:
                        if item.lower().startswith("learning objective"):
                            break
                        following.append(item)
                    chapter_title = inline_title or " ".join(following).strip()
                    exercise_id = None
                exercise_match = EXERCISE_RE.match(line)
                if exercise_match:
                    exercise_id = " ".join(
                        item for item in exercise_match.groups() if item
                    )

            context = " > ".join(
                value
                for value in [
                    f"Chapter {chapter_number}" if chapter_number else None,
                    chapter_title,
                    exercise_id,
                ]
                if value
            )
            for index, block in enumerate(split_blocks(text)):
                content = f"{context}\n\n{block}" if context else block
                chunks.append(
                    make_chunk(
                        page_number,
                        f"page-{page_number}-text-{index}",
                        content,
                        "prose",
                        chapter_number,
                        chapter_title,
                        exercise_id,
                        pdf_path.name,
                    )
                )

            settings = [
                {
                    "vertical_strategy": "lines",
                    "horizontal_strategy": "lines",
                    "intersection_tolerance": 5,
                },
                {
                    "vertical_strategy": "text",
                    "horizontal_strategy": "text",
                    "text_tolerance": 3,
                },
            ]
            seen_tables: set[str] = set()
            for table_settings in settings:
                accepted_for_strategy = 0
                for table_index, table in enumerate(
                    page.extract_tables(table_settings=table_settings)
                ):
                    markdown = markdown_table(table)
                    digest = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
                    if not markdown or digest in seen_tables:
                        continue
                    seen_tables.add(digest)
                    accepted_for_strategy += 1
                    content = (
                        f"{context}\n\nTable from workbook page {page_number}\n\n{markdown}"
                        if context
                        else f"Table from workbook page {page_number}\n\n{markdown}"
                    )
                    chunks.append(
                        make_chunk(
                            page_number,
                            f"page-{page_number}-table-{table_index}-{digest[:8]}",
                            content,
                            "table",
                            chapter_number,
                            chapter_title,
                            exercise_id,
                            pdf_path.name,
                        )
                    )
                if accepted_for_strategy:
                    break
    return chunks


def make_chunk(
    page: int,
    chunk_id: str,
    content: str,
    content_type: str,
    chapter_number: int | None,
    chapter_title: str | None,
    exercise_id: str | None,
    source_file: str,
) -> dict[str, Any]:
    return {
        "corpus": "accounting_workbook",
        "documentId": "cairo-university-introduction-financial-accounting-part-2",
        "chunkId": chunk_id,
        "content": content,
        "metadata": {
            "chapterNumber": chapter_number,
            "chapterTitle": chapter_title,
            "exerciseId": exercise_id,
            "pageStart": page,
            "pageEnd": page,
            "contentType": content_type,
            "language": "en",
            "sourceFile": source_file,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("knowledge/accounting-workbook.chunks.json"),
    )
    args = parser.parse_args()
    chunks = extract(args.pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(chunks, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Wrote {len(chunks)} chunks to {args.output}")


if __name__ == "__main__":
    main()
