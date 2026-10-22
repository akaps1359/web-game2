#!/bin/sh
# Natural Earth(퍼블릭 도메인) 데이터 다운로드 — 지도 재생성 시에만 필요
set -e
mkdir -p ne
base=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_10m_admin_1_states_provinces ne_10m_land ne_10m_lakes ne_10m_rivers_lake_centerlines ne_10m_geography_regions_polys ne_10m_populated_places_simple; do
  [ -f ne/$f.geojson ] || curl -sSL -o ne/$f.geojson $base/$f.geojson
done
