/**
 * Rejects placeholder-style title/body text: all digits, repeated characters
 * (case-insensitive), strict two-character alternation, whole-string repetition
 * of a short unit, or very low letter/digit variety (e.g. "adsasd").
 */
export function getPostTextQualityError(raw: string): string | null {
    const t = raw.trim();
    if (t.length === 0) return null;

    const lower = t.toLowerCase();

    const digitsOnly = t.replace(/\s/g, "");
    if (digitsOnly.length > 0 && /^\d+$/.test(digitsOnly)) {
        return "Can't be only numbers (e.g. 11111 or 12345).";
    }

    /** Same character or digit repeated, ignoring letter case (catches AaAaA, xxxxx). */
    if (lower.length >= 3 && /^(.)\1+$/.test(lower)) {
        return "Can't be repeating the same character or digit (e.g. aaaaa, xxxxx).";
    }

    /** Strict ABAB… pattern, length ≥ 4 (catches asasas; avoids blocking "bob"/"eve"). */
    if (lower.length >= 4) {
        const a = lower[0];
        const b = lower[1];
        if (a !== b) {
            let alternating = true;
            for (let i = 0; i < lower.length; i++) {
                if (lower[i] !== (i % 2 === 0 ? a : b)) {
                    alternating = false;
                    break;
                }
            }
            if (alternating) {
                return "Can't be a back-and-forth pattern (e.g. asasas, ababab).";
            }
        }
    }

    if (lower.length >= 4) {
        for (let L = 1; L <= Math.floor(lower.length / 2); L++) {
            if (lower.length % L !== 0) continue;
            const unit = lower.slice(0, L);
            let repeats = true;
            for (let i = L; i < lower.length; i += L) {
                if (lower.slice(i, i + L) !== unit) {
                    repeats = false;
                    break;
                }
            }
            if (repeats && lower.length / L >= 2 && L > 1) {
                return "Can't be the same short phrase repeated over and over.";
            }
        }
    }

    const core = lower.replace(/[^a-z0-9]/g, "");
    if (core.length >= 6) {
        const unique = new Set(core).size;
        const minUnique = Math.max(3, Math.ceil(core.length * 0.55));
        if (unique < minUnique) {
            return "Use more varied letters or words — this looks like random typing.";
        }
    }

    return null;
}
