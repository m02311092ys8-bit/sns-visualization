"""UCIの元CSVからNY周辺の1日分を抽出し、CSVとGeoJSONを作る。"""

import json
from pathlib import Path

import pandas as pd


# このファイルの位置からプロジェクトの場所を求める
ROOT = Path(__file__).resolve().parents[2]

SOURCE = (
    ROOT
    / "data/raw/geographic/twitter_geospatial/twitter/twitter.csv"
)
CSV_OUTPUT = ROOT / "data/processed/geographic/nyc_2013-01-12_cst.csv"
GEOJSON_OUTPUT = ROOT / "web/public/data/nyc_2013-01-12_cst.geojson"

# NY周辺の矩形。行政区域ではない
WEST, SOUTH, EAST, NORTH = -74.3, 40.4, -73.6, 41.0

# 元データの日付はCST（UTC-6）
START = 20130112000000
END = 20130112235959
START_UTC = pd.Timestamp("2013-01-12T06:00:00Z")


def main():
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Source CSV not found: {SOURCE}")

    parts = []
    scanned = 0

    for chunk in pd.read_csv(SOURCE, chunksize=500_000):
        selected = (
            chunk["longitude"].between(WEST, EAST)
            & chunk["latitude"].between(SOUTH, NORTH)
            & chunk["timestamp"].between(START, END)
        )
        if selected.any():
            parts.append(chunk.loc[selected].copy())

        scanned += len(chunk)
        print(f"Scanned: {scanned:,}", flush=True)

    if not parts:
        raise ValueError("No matching records.")

    data = pd.concat(parts, ignore_index=True)
    data = data.sort_values("timestamp", kind="stable").reset_index(drop=True)

    if len(data) != 34_260:
        raise ValueError(f"Unexpected record count: {len(data):,}")

    times = pd.to_datetime(
        data["timestamp"].astype("string"),
        format="%Y%m%d%H%M%S",
        errors="raise",
    ).dt.tz_localize("Etc/GMT+6").dt.tz_convert("UTC")

    features = []
    for row, utc in zip(data.itertuples(index=False), times):
        elapsed = int((utc - START_UTC).total_seconds())
        if not 0 <= elapsed < 86400:
            raise ValueError("Timestamp outside target day.")

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [
                    float(row.longitude),
                    float(row.latitude),
                ],
            },
            "properties": {
                "timestamp_utc": utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "elapsed_seconds": elapsed,
            },
        })

    geojson = {"type": "FeatureCollection", "features": features}

    # 既存の公開用データがあれば、今回の生成結果と一致するか確認
    if GEOJSON_OUTPUT.exists():
        with GEOJSON_OUTPUT.open(encoding="utf-8") as file:
            existing = json.load(file)
        if existing != geojson:
            raise ValueError(
                "Generated data differs from existing GeoJSON. "
                "No output files were changed."
            )
        print("Existing GeoJSON matches generated data.")

    CSV_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    GEOJSON_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    data.to_csv(CSV_OUTPUT, index=False)
    with GEOJSON_OUTPUT.open("w", encoding="utf-8") as file:
        json.dump(
            geojson,
            file,
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        )

    print(f"Rows: {len(data):,}")
    print(f"CSV: {CSV_OUTPUT}")
    print(f"GeoJSON: {GEOJSON_OUTPUT}")
    print("Done.")


if __name__ == "__main__":
    main()