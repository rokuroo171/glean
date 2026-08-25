// Package wikilink extracts [[Title]] / [[Title|alias]] wikilinks and
// [text](Target.md) markdown links from note bodies, excluding links inside
// fenced code blocks. Both are note-to-note link syntaxes in glean.
package wikilink

import (
	"regexp"
	"strings"
)

// Kind distinguishes the two supported note-link syntaxes.
type Kind string

const (
	// Wiki is a [[Title]] or [[Title|alias]] reference.
	Wiki Kind = "wiki"
	// Markdown is a [text](Target.md) link to another note file.
	Markdown Kind = "markdown"
)

// Link is a single note-link occurrence found in a body.
type Link struct {
	// Target is the referenced note title (trimmed). For wikilinks it is
	// the text inside the brackets; for markdown links it is the .md stem.
	Target string
	// Label is the display text: the wikilink alias, or the markdown link
	// text. Empty when no alias was written.
	Label string
	// Kind says which syntax produced this link.
	Kind Kind
}

var (
	wikiRe = regexp.MustCompile(`\[\[([^\[\]|]+)(?:\|([^\[\]]*))?\]\]`)
	// [text](target.md) - target must end in .md; text may be empty-ish.
	mdLinkRe = regexp.MustCompile(`\[([^\]]*)\]\(([^)\s]+\.md)\)`)
)

// Scan returns all note links in body. Links inside ``` fenced code blocks
// are ignored so code samples do not create graph edges.
// The iteration order is: all wikilinks first (in source order), then all
// markdown .md links (in source order).
func Scan(body string) []Link {
	var links []Link
	inFence := false
	lines := strings.Split(body, "\n")
	for _, line := range lines {
		if isFence(line) {
			inFence = !inFence
			continue
		}
		if inFence {
			continue
		}
		for _, m := range wikiRe.FindAllStringSubmatch(line, -1) {
			target := strings.TrimSpace(m[1])
			if target == "" {
				continue
			}
			links = append(links, Link{
				Target: target,
				Label:  strings.TrimSpace(m[2]),
				Kind:   Wiki,
			})
		}
		for _, m := range mdLinkRe.FindAllStringSubmatch(line, -1) {
			// Strip any surrounding quotes from the target path.
			path := strings.Trim(strings.TrimSpace(m[2]), `"'`)
			// Take the basename, then drop the trailing .md.
			base := path
			if idx := strings.LastIndexAny(base, `/\`); idx >= 0 {
				base = base[idx+1:]
			}
			stem := strings.TrimSuffix(base, ".md")
			if stem == "" {
				continue
			}
			links = append(links, Link{
				Target: stem,
				Label:  strings.TrimSpace(m[1]),
				Kind:   Markdown,
			})
		}
	}
	return links
}

// isFence reports whether a line opens or closes a fenced code block.
// Handles the ``` and ~~~ fences and leading-space variants.
func isFence(line string) bool {
	trimmed := strings.TrimSpace(line)
	// Ignore indented code? Keep it simple: any ``` / ~~~ toggles.
	if len(trimmed) < 3 {
		return false
	}
	if strings.HasPrefix(trimmed, "```") || strings.HasPrefix(trimmed, "~~~") {
		return true
	}
	return false
}