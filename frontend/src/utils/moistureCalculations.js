export function calculateMoistureDistribution(readings = []) {
    const uniqueReadings = [];
    const seen = new Set();

    readings.forEach(reading => {
        const moisture = Number(reading.moisture_percent);
        const recordNumber = Number(reading.device_record_number);
        if (!Number.isFinite(moisture) || !Number.isFinite(recordNumber)) return;

        const key = `${recordNumber}\u0000${moisture}`;
        if (seen.has(key)) return;
        seen.add(key);
        uniqueReadings.push({ ...reading, moisture_percent: moisture, device_record_number: recordNumber });
    });

    uniqueReadings.sort((a, b) => (
        a.device_record_number - b.device_record_number
        || a.moisture_percent - b.moisture_percent
        || String(a.captured_at || '').localeCompare(String(b.captured_at || ''))
    ));

    if (uniqueReadings.length === 0) {
        return { readings: [], bins: [], count: 0, min: null, max: null, mean: null, standardDeviation: null };
    }

    const values = uniqueReadings.map(reading => reading.moisture_percent);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
    const counts = new Map();

    values.forEach(value => {
        const bin = Math.floor(value);
        counts.set(bin, (counts.get(bin) || 0) + 1);
    });

    const bins = [];
    for (let bin = Math.floor(min); bin <= Math.floor(max); bin += 1) {
        bins.push({ bin, label: `${bin}%`, count: counts.get(bin) || 0 });
    }

    return {
        readings: uniqueReadings,
        bins,
        count: values.length,
        min,
        max,
        mean,
        standardDeviation: Math.sqrt(variance),
    };
}
