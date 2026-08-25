// Package wikilink extracts [[Title]] and [[Title|alias]] links from note
// bodies, excluding links inside fenced code blocks.
package wikilink

import (
	"regexp"
	"strings"
)

// Link is a single wikilink occurrence found in a body.
type Link struct {
	// Target is the note title inside the brackets (trimmed).
	Target string
	// Alias is the optional display text after "|", or "".
	Alias string
}

var linkRe = regexp.MustCompile(`\[\[([^\[\]|]+)(?:\|([^\[\]]*))?\]\]`)

// Scan returns all wikilinks in body. Links inside ``` fenced code blocks
// are ignored so code samples do not create graph edges.
func Scan(body string) []Link {
	var links []Link
	inFence := false
	lines := strings.Split(body, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "```") {
			inFence = !inFence
			continue
		}
		if inFence {
			continue
		}
		for _, m := range linkRe.FindAllStringSubmatch(line, -1) {
			target := strings.TrimSpace(m[1])
			if target == "" {
				continue
			}
			alias := strings.TrimSpace(m[2])
			links = append(links, Link{Target: target, Alias: alias})
		}
	}
	return links
}