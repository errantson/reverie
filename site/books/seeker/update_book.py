#!/usr/bin/env python3
"""
Update individual chapter files from the master seekers.md source file.
Preserves the color comment header in each chapter file.
"""

import re
import os

# Configuration
SOURCE_FILE = "seekers.md"
CHAPTER_DIR = "."

# Mapping of chapter files to their chapter identifiers in seekers.md
CHAPTER_MAP = {
    "sr00-preface.md": "preface",
    "sr01-escaping_oneself.md": "Chapter 1",
    "sr02-welcome_to_reverie_house.md": "Chapter 2",
    "sr03-remembering_the_way.md": "Chapter 3",
    "sr04-gardens_guardian.md": "Chapter 4",
    "sr05-free_food_and_arguments.md": "Chapter 5",
    "sr06-inside_the_orren.md": "Chapter 6",
    "sr07-eyes_of_the_dreamweaver.md": "Chapter 7",
    "sr08-a_well_of_perfect_dreams.md": "Chapter 8",
    "sr09-limitatio_temporaria.md": "Chapter 9",
    "sr10-the_long_path_home.md": "Chapter 10",
    "sr11-best_laid_plans.md": "Chapter 11",
    "sr12-in_the_shadow_of_callie.md": "Chapter 12",
    "sr13-the_unending_nightmare.md": "Chapter 13",
    "sr14-sweet_reverie.md": "Chapter 14",
}


def read_source_file(filepath):
    """Read the master source file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def extract_preface(content):
    """Extract the preface section from the source file."""
    # Preface starts after the front matter and before Chapter 1
    # Look for the preface content between the last # before chapters and Chapter 1
    
    # Find where the actual preface text starts (after the image references at top)
    # The preface starts with "By way of my strangest dreams"
    preface_start = content.find("By way of my strangest dreams")
    if preface_start == -1:
        return None
    
    # Find Chapter 1
    chapter1_match = re.search(r'\n# \*\*Chapter 1\*\*', content)
    if not chapter1_match:
        return None
    
    preface_text = content[preface_start:chapter1_match.start()].strip()
    
    # Remove trailing # markers
    preface_text = re.sub(r'\n#\s*\n#\s*$', '', preface_text).strip()
    
    return preface_text


def extract_chapter(content, chapter_num):
    """Extract a specific chapter's content from the source file."""
    # Pattern to match chapter header
    chapter_pattern = rf'# \*\*Chapter {chapter_num}\*\*[^\n]*\n'
    
    chapter_match = re.search(chapter_pattern, content)
    if not chapter_match:
        return None
    
    # Find start of content (after the chapter header)
    start = chapter_match.end()
    
    # Find end of chapter (next chapter header or Au Finoir section)
    if chapter_num < 14:
        next_chapter_pattern = rf'# \*\*Chapter {chapter_num + 1}\*\*'
        next_match = re.search(next_chapter_pattern, content[start:])
        if next_match:
            end = start + next_match.start()
        else:
            end = len(content)
    else:
        # For chapter 14, end at "Au Finoir"
        au_finoir_match = re.search(r'# \*\*Au Finoir\*\*', content[start:])
        if au_finoir_match:
            end = start + au_finoir_match.start()
        else:
            end = len(content)
    
    chapter_text = content[start:end].strip()
    
    # Remove trailing # markers and image references
    chapter_text = re.sub(r'\n#\s*$', '', chapter_text).strip()
    
    return chapter_text


def get_color_header(filepath):
    """Extract the color comment header from an existing chapter file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            if first_line.startswith('<!-- color:'):
                return first_line
    except FileNotFoundError:
        pass
    return None


def update_chapter_file(filepath, color_header, content):
    """Write updated content to a chapter file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f"{color_header}\n\n{content}\n")


def main():
    # Read source file
    source_path = os.path.join(CHAPTER_DIR, SOURCE_FILE)
    print(f"Reading source file: {source_path}")
    source_content = read_source_file(source_path)
    
    updated = 0
    errors = 0
    
    for chapter_file, chapter_id in CHAPTER_MAP.items():
        filepath = os.path.join(CHAPTER_DIR, chapter_file)
        
        # Get existing color header
        color_header = get_color_header(filepath)
        if not color_header:
            print(f"  ERROR: No color header found in {chapter_file}")
            errors += 1
            continue
        
        # Extract chapter content
        if chapter_id == "preface":
            chapter_content = extract_preface(source_content)
        else:
            chapter_num = int(chapter_id.split()[1])
            chapter_content = extract_chapter(source_content, chapter_num)
        
        if not chapter_content:
            print(f"  ERROR: Could not extract content for {chapter_id}")
            errors += 1
            continue
        
        # Update the file
        update_chapter_file(filepath, color_header, chapter_content)
        print(f"  Updated: {chapter_file} ({len(chapter_content)} chars)")
        updated += 1
    
    print(f"\nDone! Updated {updated} files, {errors} errors.")


if __name__ == "__main__":
    main()
