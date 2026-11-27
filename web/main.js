import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './style.css';

const timeline = document.querySelector('#timeline');
const clock = document.querySelector('#clock');
const count = document.querySelector('#count');
const status = document.querySelector('#status');
const controls = document.querySelector('#controls');
const play = document.querySelector('#play');
const reset = document.querySelector('#reset');
const speed = document.querySelector('#speed');
const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();
const START = Date.parse('2011-03-11T14:46:00+09:00');
const END = 86399;
const dateFormat = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
let current = Number(timeline.value);
let playing = false;
let animationFrame = null;
let previousTime = null;
let previousSecond = -1;
let seconds = [];
let map;

function pause() {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    playing = false;
    previousTime = null;
    play.textContent = '再生';
}

function formatTime(value) {
    return dateFormat.format(new Date(START + value * 1000));
}

function lowerBound(value) {
    let low = 0;
    let high = seconds.length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (seconds[middle] < value) low = middle + 1;
        else high = middle;
    }
    return low;
}

function update() {
    const end = Math.floor(current);
    timeline.value = String(end);
    clock.textContent = formatTime(end);
    timeline.setAttribute('aria-valuetext', `${formatTime(end)} JST・人工時刻`);
    map.setFilter('tweets', ['<=', ['get', 'simulated_elapsed_seconds'], end]);
    const visible = lowerBound(end + 1);
    count.textContent = `${visible.toLocaleString('ja-JP')}件`;
    previousSecond = end;
}

function tick(now) {
    if (!playing) return;
    if (previousTime !== null) {
        const elapsed = Math.min((now - previousTime) / 1000, 0.25);
        current = Math.min(END, current + elapsed * Number(speed.value));
    }
    previousTime = now;
    if (Math.floor(current) !== previousSecond) update();
    if (current >= END) { pause(); return; }
    animationFrame = requestAnimationFrame(tick);
}

play.addEventListener('click', () => {
    if (playing) { pause(); return; }
    if (current >= END) { current = 0; update(); }
    playing = true;
    previousTime = null;
    play.textContent = '停止';
    animationFrame = requestAnimationFrame(tick);
});
timeline.addEventListener('input', () => {
    pause(); current = Number(timeline.value); update();
});
reset.addEventListener('click', () => { pause(); current = 0; update(); });
document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
});

// 元の配列を変更せず、Mapbox表示用のGeoJSONへ変換する。
function toGeoJSON(rows) {
    if (!Array.isArray(rows) || !rows.length) throw new Error('投稿データがありません。');
    const features = rows.map((row, index) => {
        const coord = row.position?.cartographicDegrees;
        const elapsed = row.simulated_elapsed_seconds;
        if (!Array.isArray(coord) || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1]) ||
            Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90 ||
            !Number.isInteger(elapsed) || elapsed < 0 || elapsed > END ||
            row.time_is_simulated !== true ||
            Date.parse(row.simulated_at) !== START + elapsed * 1000) {
            throw new Error(`${index + 1}件目の座標または人工時刻が不正です。`);
        }
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: coord.slice(0, 2) },
            properties: {
                id: String(row.id), text: String(row.text ?? ''),
                simulated_at: row.simulated_at,
                simulated_elapsed_seconds: elapsed, time_is_simulated: true,
            },
        };
    });
    return { type: 'FeatureCollection', features };
}

async function start() {
    if (!token?.startsWith('pk.')) {
        status.textContent = '.env.localのVITE_MAPBOX_ACCESS_TOKENを確認し、開発サーバーを再起動してください。';
        return;
    }
    try {
        map = new mapboxgl.Map({
            container: 'map', accessToken: token,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [138.5, 37.2], zoom: 4.5,
        });
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.on('error', () => {
            status.textContent = '地図の読み込みエラー。接続・Mapboxトークン・利用状況を確認してください。';
        });
        map.on('load', async () => {
            try {
                const response = await fetch(`${import.meta.env.BASE_URL}data/tweets_simulated_24h.json`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = toGeoJSON(await response.json());
                seconds = data.features.map(f => f.properties.simulated_elapsed_seconds).sort((a, b) => a - b);
                map.addSource('tweet-data', { type: 'geojson', data });
                map.addLayer({
                    id: 'tweets', type: 'circle', source: 'tweet-data',
                    filter: ['==', ['get', 'simulated_elapsed_seconds'], -1],
                    paint: {
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 13, 6],
                        'circle-color': '#47e6c1', 'circle-opacity': 0.85,
                        'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff',
                    },
                });
                map.on('click', 'tweets', event => {
                    const feature = event.features?.[0];
                    if (!feature) return;
                    const box = document.createElement('div');
                    const text = document.createElement('p');
                    text.textContent = feature.properties.text;
                    const time = document.createElement('p');
                    time.textContent = `人工時刻：${formatTime(feature.properties.simulated_elapsed_seconds)} JST`;
                    const note = document.createElement('p');
                    note.textContent = '実際の投稿時刻ではありません。';
                    box.append(text, time, note);
                    new mapboxgl.Popup().setLngLat(feature.geometry.coordinates).setDOMContent(box).addTo(map);
                });
                map.on('mouseenter', 'tweets', () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mouseleave', 'tweets', () => { map.getCanvas().style.cursor = ''; });
                update();
                controls.disabled = false;
                status.textContent = `${data.features.length.toLocaleString('ja-JP')}件を読み込みました。時刻は人工的に設定したデモです。`;
            } catch (error) {
                status.textContent = `データ読み込み失敗：${error.message}`;
            }
        });
    } catch (error) { status.textContent = `起動失敗：${error.message}`; }
}
start();
