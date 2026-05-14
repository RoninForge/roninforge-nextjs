#!/bin/sh
# Validates the plugin structure and content.
# Run from the repository root: ./tests/validation/validate-plugin.sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ERRORS=0
WARNINGS=0

red() { printf "\033[31m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

error() { red "ERROR: $1"; ERRORS=$((ERRORS + 1)); }
warn() { yellow "WARN: $1"; WARNINGS=$((WARNINGS + 1)); }
pass() { green "PASS: $1"; }

echo "=== Plugin Structure Validation ==="
echo ""

# 1. Check plugin.json exists and is valid JSON
if [ -f "$REPO_ROOT/.cursor-plugin/plugin.json" ]; then
    if python3 -c "import json; json.load(open('$REPO_ROOT/.cursor-plugin/plugin.json'))" 2>/dev/null; then
        pass "plugin.json is valid JSON"

        # Check required fields
        NAME=$(python3 -c "import json; print(json.load(open('$REPO_ROOT/.cursor-plugin/plugin.json')).get('name', ''))")
        if [ -n "$NAME" ]; then
            pass "plugin.json has 'name' field: $NAME"
        else
            error "plugin.json missing required 'name' field"
        fi

        # Check recommended fields
        for field in version description author license; do
            HAS=$(python3 -c "import json; d=json.load(open('$REPO_ROOT/.cursor-plugin/plugin.json')); print('yes' if '$field' in d else 'no')")
            if [ "$HAS" = "yes" ]; then
                pass "plugin.json has '$field' field"
            else
                warn "plugin.json missing recommended '$field' field"
            fi
        done
    else
        error "plugin.json is not valid JSON"
    fi
else
    error ".cursor-plugin/plugin.json not found"
fi

echo ""
echo "=== Rule Files ==="
echo ""

# 2. Check rule files
RULE_COUNT=0
for rule_file in "$REPO_ROOT"/rules/*.mdc; do
    [ -f "$rule_file" ] || continue
    RULE_COUNT=$((RULE_COUNT + 1))
    fname=$(basename "$rule_file")

    # Check for YAML frontmatter
    first_line=$(head -1 "$rule_file")
    if [ "$first_line" = "---" ]; then
        pass "$fname has YAML frontmatter"

        # Check for description in frontmatter
        if grep -q "^description:" "$rule_file"; then
            pass "$fname has description"
        else
            warn "$fname missing description in frontmatter"
        fi

        # Check for either alwaysApply or globs
        HAS_ALWAYS=$(grep -c "^alwaysApply:" "$rule_file" 2>/dev/null || true)
        HAS_GLOBS=$(grep -c "^globs:" "$rule_file" 2>/dev/null || true)
        if [ "$HAS_ALWAYS" -gt 0 ] || [ "$HAS_GLOBS" -gt 0 ]; then
            pass "$fname has application strategy (alwaysApply or globs)"
        else
            pass "$fname is agent-requested (no alwaysApply/globs - this is intentional)"
        fi
    else
        error "$fname missing YAML frontmatter (must start with ---)"
    fi

    # Check line count (recommended < 500)
    LINES=$(wc -l < "$rule_file" | tr -d ' ')
    if [ "$LINES" -lt 500 ]; then
        pass "$fname is $LINES lines (under 500 limit)"
    else
        warn "$fname is $LINES lines (recommended under 500)"
    fi
done

if [ "$RULE_COUNT" -gt 0 ]; then
    pass "Found $RULE_COUNT rule files"
else
    error "No .mdc rule files found in rules/"
fi

echo ""
echo "=== Skill Files ==="
echo ""

# 3. Check skill files
SKILL_COUNT=0
for skill_dir in "$REPO_ROOT"/skills/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")

    if [ -f "$skill_dir/SKILL.md" ]; then
        SKILL_COUNT=$((SKILL_COUNT + 1))
        pass "Skill '$skill_name' has SKILL.md"

        # Check for YAML frontmatter
        first_line=$(head -1 "$skill_dir/SKILL.md")
        if [ "$first_line" = "---" ]; then
            pass "Skill '$skill_name' has YAML frontmatter"

            # Check required frontmatter fields
            if grep -q "^name:" "$skill_dir/SKILL.md"; then
                # Verify name matches directory
                SKILL_NAME_VALUE=$(grep "^name:" "$skill_dir/SKILL.md" | head -1 | sed 's/name: *//' | tr -d '"')
                if [ "$SKILL_NAME_VALUE" = "$skill_name" ]; then
                    pass "Skill '$skill_name' name matches directory"
                else
                    error "Skill name '$SKILL_NAME_VALUE' does not match directory '$skill_name'"
                fi
            else
                error "Skill '$skill_name' missing 'name' in frontmatter"
            fi

            if grep -q "^description:" "$skill_dir/SKILL.md"; then
                pass "Skill '$skill_name' has description"
            else
                error "Skill '$skill_name' missing 'description' in frontmatter"
            fi
        else
            error "Skill '$skill_name' SKILL.md missing YAML frontmatter"
        fi
    else
        error "Skill directory '$skill_name' missing SKILL.md"
    fi
done

if [ "$SKILL_COUNT" -gt 0 ]; then
    pass "Found $SKILL_COUNT skills"
else
    warn "No skills found in skills/"
fi

echo ""
echo "=== Agent Files ==="
echo ""

# 4. Check agent files
AGENT_COUNT=0
for agent_file in "$REPO_ROOT"/agents/*.md; do
    [ -f "$agent_file" ] || continue
    AGENT_COUNT=$((AGENT_COUNT + 1))
    fname=$(basename "$agent_file")

    first_line=$(head -1 "$agent_file")
    if [ "$first_line" = "---" ]; then
        pass "Agent '$fname' has YAML frontmatter"

        if grep -q "^name:" "$agent_file"; then
            pass "Agent '$fname' has name"
        else
            error "Agent '$fname' missing 'name' in frontmatter"
        fi

        if grep -q "^description:" "$agent_file"; then
            pass "Agent '$fname' has description"
        else
            warn "Agent '$fname' missing description"
        fi
    else
        error "Agent '$fname' missing YAML frontmatter"
    fi
done

if [ "$AGENT_COUNT" -gt 0 ]; then
    pass "Found $AGENT_COUNT agent files"
else
    warn "No agent files found in agents/"
fi

echo ""
echo "=== Required Files ==="
echo ""

# 5. Check required repo files
for req_file in README.md LICENSE CHANGELOG.md; do
    if [ -f "$REPO_ROOT/$req_file" ]; then
        pass "$req_file exists"
    else
        error "$req_file not found"
    fi
done

echo ""
echo "=== Content Accuracy Checks ==="
echo ""

# 6. correct-sample fixture must be free of banned Next.js 16 patterns.
#    Skip lines starting with // so teaching comments naming bad patterns
#    do not match. Each grep is anchored at start-of-line whitespace.
CORRECT_DIR="$REPO_ROOT/tests/fixtures/correct-sample"

# 6a. Sync cookies()/headers()/draftMode() - must be awaited in v16.
SYNC_COOKIES=$(grep -rnE '^[[:space:]]*(const|let|var)?[[:space:]]*\S+[[:space:]]*=[[:space:]]*(cookies|headers|draftMode)\(\)\.' "$CORRECT_DIR/" 2>/dev/null | grep -vE ':[[:space:]]*//' | head -5 || true)

# 6b. useFormState (deprecated React-DOM hook, removed in favor of useActionState).
USE_FORMSTATE=$(grep -rnE 'useFormState' "$CORRECT_DIR/" 2>/dev/null | grep -vE ':[[:space:]]*//' | head -5 || true)

# 6c. Pages Router data-fetching APIs.
PAGES_ROUTER=$(grep -rnE 'getServerSideProps|getStaticProps|getInitialProps' "$CORRECT_DIR/" 2>/dev/null | grep -vE ':[[:space:]]*//' | head -5 || true)

# 6d. pages/api/* directory presence.
PAGES_API=$(find "$CORRECT_DIR" -type d -path '*/pages/api*' 2>/dev/null | head -3 || true)

# 6e. middleware.ts (renamed to proxy.ts in v16) - file should not exist in correct-sample.
MIDDLEWARE_FILE=$(find "$CORRECT_DIR" -name 'middleware.ts' -not -path '*/node_modules/*' 2>/dev/null | head -3 || true)

# 6f. experimental.ppr / experimental.dynamicIO / experimental.useCache flags (removed in v16).
EXPERIMENTAL_FLAGS=$(grep -rnE 'experimental[[:space:]]*:[[:space:]]*\{[^}]*(ppr|dynamicIO|useCache)' "$CORRECT_DIR/" 2>/dev/null | grep -vE ':[[:space:]]*//' | head -5 || true)
EXPERIMENTAL_FLAGS2=$(grep -rnE '^[[:space:]]*(ppr|dynamicIO|useCache)[[:space:]]*:[[:space:]]*true' "$CORRECT_DIR/" 2>/dev/null | grep -vE ':[[:space:]]*//' | head -5 || true)

# 6g. images.domains (deprecated, use remotePatterns).
IMAGES_DOMAINS=$(grep -rnE '^[[:space:]]*domains[[:space:]]*:[[:space:]]*\[' "$CORRECT_DIR/" 2>/dev/null | grep -vE ':[[:space:]]*//' | head -5 || true)

# 6h. next/legacy/image import.
LEGACY_IMAGE=$(grep -rnE "from[[:space:]]+['\"]next/legacy/image['\"]" "$CORRECT_DIR/" 2>/dev/null | grep -vE ':[[:space:]]*//' | head -5 || true)

# 6i. NEXT_PUBLIC_*_SECRET / KEY / TOKEN / PASSWORD - secret-looking env vars behind the public prefix.
NEXT_PUBLIC_SECRET=$(grep -rnE 'NEXT_PUBLIC_[A-Z_]*(SECRET|PRIVATE|TOKEN|PASSWORD|PASS|API_KEY)' "$CORRECT_DIR/" 2>/dev/null | grep -vE ':[[:space:]]*//' | head -5 || true)

# 6j. revalidateTag with a single argument - in v16 the 2-arg form (tag, profile) is required.
#     Match revalidateTag( <stringLiteral> ) with NO comma before the close paren.
SINGLE_ARG_REVALIDATE=$(grep -rnE "revalidateTag\([[:space:]]*['\"][^'\"]*['\"][[:space:]]*\)" "$CORRECT_DIR/" 2>/dev/null | grep -vE ':[[:space:]]*//' | head -5 || true)

# 6k. redirect() inside try/catch - heuristic: look for "redirect(" on a line whose nearest
#     preceding non-blank context is a try { block. Approximate by grepping for `try {`
#     followed within ~20 lines by `redirect(` followed within ~20 lines by `catch`.
#     Implemented as a multi-line awk scan over each file.
REDIRECT_IN_TRY=""
for f in $(find "$CORRECT_DIR" -type f \( -name '*.ts' -o -name '*.tsx' \) -not -path '*/node_modules/*' 2>/dev/null); do
    awk_out=$(awk '
        /^[[:space:]]*try[[:space:]]*\{/ { in_try=1; try_line=NR; next }
        in_try && /^[[:space:]]*\}[[:space:]]*catch/ { in_try=0; next }
        in_try && /redirect[[:space:]]*\(/ && !/^[[:space:]]*\/\// {
            print FILENAME ":" NR ": " $0
        }
    ' "$f" 2>/dev/null)
    if [ -n "$awk_out" ]; then
        REDIRECT_IN_TRY="$REDIRECT_IN_TRY
$awk_out"
    fi
done

CORRECT_VIOLATIONS=0
[ -n "$SYNC_COOKIES" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))
[ -n "$USE_FORMSTATE" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))
[ -n "$PAGES_ROUTER" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))
[ -n "$PAGES_API" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))
[ -n "$MIDDLEWARE_FILE" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))
[ -n "$EXPERIMENTAL_FLAGS" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))
[ -n "$EXPERIMENTAL_FLAGS2" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))
[ -n "$IMAGES_DOMAINS" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))
[ -n "$LEGACY_IMAGE" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))
[ -n "$NEXT_PUBLIC_SECRET" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))
[ -n "$SINGLE_ARG_REVALIDATE" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))
[ -n "$REDIRECT_IN_TRY" ] && CORRECT_VIOLATIONS=$((CORRECT_VIOLATIONS + 1))

if [ "$CORRECT_VIOLATIONS" -eq 0 ]; then
    pass "correct-sample fixture is free of banned Next.js 16 patterns"
else
    error "correct-sample contains banned Next.js 16 patterns:"
    [ -n "$SYNC_COOKIES" ] && echo "Sync cookies()/headers()/draftMode():" && echo "$SYNC_COOKIES"
    [ -n "$USE_FORMSTATE" ] && echo "useFormState (deprecated, use useActionState):" && echo "$USE_FORMSTATE"
    [ -n "$PAGES_ROUTER" ] && echo "Pages Router data APIs:" && echo "$PAGES_ROUTER"
    [ -n "$PAGES_API" ] && echo "pages/api directory present:" && echo "$PAGES_API"
    [ -n "$MIDDLEWARE_FILE" ] && echo "middleware.ts present (renamed to proxy.ts in v16):" && echo "$MIDDLEWARE_FILE"
    [ -n "$EXPERIMENTAL_FLAGS" ] && echo "experimental.ppr/dynamicIO/useCache flags:" && echo "$EXPERIMENTAL_FLAGS"
    [ -n "$EXPERIMENTAL_FLAGS2" ] && echo "experimental.ppr/dynamicIO/useCache flags:" && echo "$EXPERIMENTAL_FLAGS2"
    [ -n "$IMAGES_DOMAINS" ] && echo "images.domains (deprecated, use remotePatterns):" && echo "$IMAGES_DOMAINS"
    [ -n "$LEGACY_IMAGE" ] && echo "next/legacy/image import:" && echo "$LEGACY_IMAGE"
    [ -n "$NEXT_PUBLIC_SECRET" ] && echo "NEXT_PUBLIC_ secret-looking var:" && echo "$NEXT_PUBLIC_SECRET"
    [ -n "$SINGLE_ARG_REVALIDATE" ] && echo "revalidateTag single-arg (requires 2-arg in v16):" && echo "$SINGLE_ARG_REVALIDATE"
    [ -n "$REDIRECT_IN_TRY" ] && echo "redirect() inside try/catch (heuristic):" && echo "$REDIRECT_IN_TRY"
fi

# 7. anti-pattern-sample must contain at least 10 tracked violations.
ANTI_DIR="$REPO_ROOT/tests/fixtures/anti-pattern-sample"
ANTI_HITS=$(grep -rcE 'getServerSideProps|getStaticProps|useFormState|experimental[[:space:]]*:[[:space:]]*\{|^[[:space:]]*(ppr|dynamicIO|useCache)[[:space:]]*:[[:space:]]*true|images[[:space:]]*:[[:space:]]*\{[^}]*domains|from[[:space:]]+["\x27]next/legacy/image["\x27]|NEXT_PUBLIC_[A-Z_]*(SECRET|TOKEN|API_KEY)|next/router|serverRuntimeConfig|publicRuntimeConfig|revalidateTag\([[:space:]]*["\x27][^,"\x27]*["\x27][[:space:]]*\)' "$ANTI_DIR/" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')

# Also count file-level signals: middleware.ts presence and sync cookies()/params usage and webpack config block.
MIDDLE_PRESENT=$(find "$ANTI_DIR" -name 'middleware.ts' -not -path '*/node_modules/*' 2>/dev/null | wc -l | tr -d ' ')
SYNC_HITS=$(grep -rcE '(cookies|headers|draftMode)\(\)\.[a-z]' "$ANTI_DIR/" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')
WEBPACK_HITS=$(grep -rcE '^[[:space:]]*webpack[[:space:]]*:[[:space:]]*\(' "$ANTI_DIR/" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')

TOTAL_ANTI=$((ANTI_HITS + MIDDLE_PRESENT + SYNC_HITS + WEBPACK_HITS))

if [ "$TOTAL_ANTI" -ge 12 ]; then
    pass "anti-pattern-sample contains $TOTAL_ANTI tracked violations"
else
    warn "anti-pattern-sample has only $TOTAL_ANTI tracked violations (expected 12+)"
fi

echo ""
echo "=== Summary ==="
echo ""
echo "Errors:   $ERRORS"
echo "Warnings: $WARNINGS"
echo ""

if [ "$ERRORS" -gt 0 ]; then
    red "FAILED - fix $ERRORS error(s) before submission"
    exit 1
else
    if [ "$WARNINGS" -gt 0 ]; then
        yellow "PASSED with $WARNINGS warning(s)"
    else
        green "ALL CHECKS PASSED"
    fi
    exit 0
fi
