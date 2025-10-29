export default class Interval {
    start: number;
    end: number;

    constructor(start: number, end: number) {
        if (this.end < this.start) {
            throw Error("Interval end must be >= start");
        }
        this.start = start;
        this.end = end;
    }

    /**
     * Merges any overlaps between the given intervals and returns the resulting disjoint intervals sorted left to right
     */
    static union(intervals: Interval[]): Interval[] {
        if (intervals.length == 0) {
            return [];
        }
        const copy = intervals.slice(0);
        copy.sort((a, b) => a.start - b.start);

        const merged = [];
        let { start: currentStart, end: currentEnd } = intervals[0];
        
        for (const { start, end } of intervals.slice(1)) {
            if (start <= currentEnd) {
                currentEnd = Math.max(currentEnd, end);
            } else {
                merged.push({ start: currentStart, end: currentEnd });
                currentStart = start;
                currentEnd = end;
            }
        }

        // Append last interval
        merged.push({ start: currentStart, end: currentEnd });
        return merged;
    }

    /**
     * Given a list of intervals and a domain to compute over, returns a sorted list of intervals
     * within that domain *not* included in any of the given intervals.
     */
    static complement(intervals: Interval[], domain: Interval) {
        const merged = Interval.union(intervals);
        const complement = [];
        
        let prevEnd = domain.start;
        for (const { start, end } of merged) {
            if (start > prevEnd) {
                complement.push({ start: prevEnd, end: start });
            }
            prevEnd = Math.max(prevEnd, end);
        }

        if (prevEnd < domain.end) {
            complement.push({ start: prevEnd, end: domain.end });
        }

        return complement;
    }
}
