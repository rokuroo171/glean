package wikilink

import (
	"reflect"
	"testing"
)

func TestScanBasic(t *testing.T) {
	body := "See [[Alpha]] and [[Beta|b]] here."
	got := Scan(body)
	want := []Link{
		{Target: "Alpha", Kind: Wiki},
		{Target: "Beta", Label: "b", Kind: Wiki},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Scan = %+v, want %+v", got, want)
	}
}

func TestScanMarkdownLinks(t *testing.T) {
	body := "See [the alpha notes](Alpha.md) and [b](folder/Beta.md) done."
	got := Scan(body)
	want := []Link{
		{Target: "Alpha", Label: "the alpha notes", Kind: Markdown},
		{Target: "Beta", Label: "b", Kind: Markdown},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Scan = %+v, want %+v", got, want)
	}
}

func TestScanSkipsFencedCode(t *testing.T) {
	body := "Before\n```\n[[NotALink]]\n[No](No.md)\n```\nAfter [[Real]]\n```go\nif x { [[No]] [Y](y.md) }\n```"
	got := Scan(body)
	want := []Link{{Target: "Real", Kind: Wiki}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Scan = %+v, want %+v", got, want)
	}
}

func TestScanIgnoresMalformed(t *testing.T) {
	body := "[[Unclosed\na [[b]] c [[|alias]] d [x](NoExt.txt)"
	got := Scan(body)
	want := []Link{{Target: "b", Kind: Wiki}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Scan = %+v, want %+v", got, want)
	}
}

func TestScanTrimsTarget(t *testing.T) {
	got := Scan("x [[  Spaced Title  ]] y")
	if len(got) != 1 || got[0].Target != "Spaced Title" {
		t.Fatalf("Scan = %+v, want Spaced Title", got)
	}
}

func TestScanMultiplePerLine(t *testing.T) {
	got := Scan("[[A]] and [[B]] and [c](C.md)")
	if len(got) != 3 {
		t.Fatalf("Scan = %+v, want 3 links", got)
	}
}