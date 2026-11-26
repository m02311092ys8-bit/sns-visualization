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
const END = 86399;
const WINDOW = 30 * 60;
let current = Number(timeline.value);
let playing = false;
let previousTime = null;
let previousSecond = -1;
let map;
let seconds = [];

function pause() {
    playing = false;
    previousTime = null;
    play.textContent = '再生';
}

function formatTime(value) {
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const s = Math.floor(value % 60);
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// 最初に value 以上になる位置を探す。
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
    const start = Math.max(0, end - WINDOW + 1);

    timeline.value = String(end);
    clock.textContent = `2013-01-12 ${formatTime(end)}`;
    timeline.setAttribute('aria-valuetext', `${formatTime(end)} CST`);

    map.setFilter('tweets', [
        'all',
        ['>=', ['get', 'elapsed_seconds'], start],
        ['<=', ['get', 'elapsed_seconds'], end],
    ]);

    const visible = lowerBound(end + 1) - lowerBound(start);
    count.textContent = `${visible.toLocaleString('ja-JP')}件`;
    previousSecond = end;
}

function tick(now) {
    if (!playing) return;

    if (previousTime !== null) {
        // 別タブに移動した後、一気に時刻が飛ぶのを抑える。
        const elapsed = Math.min((now - previousTime) / 1000, 0.25);
        current = Math.min(END, current + elapsed * Number(speed.value));
    }
    previousTime = now;

    if (Math.floor(current) !== previousSecond) update();

    if (current >= END) {
        pause();
        return;
    }
    requestAnimationFrame(tick);
}

play.addEventListener('click', () => {
    if (playing) {
        pause();
        return;
    }
    if (current >= END) {
        current = 0;
        update();
    }
    playing = true;
    previousTime = null;
    play.textContent = '停止';
    requestAnimationFrame(tick);
});

timeline.addEventListener('input', () => {
    pause();
    current = Number(timeline.value);
    update();
});

reset.addEventListener('click', () => {
    pause();
    current = 0;
    update();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
});

async function start() {
    if (!token?.startsWith('pk.')) {
        status.textContent =
            '.env.local の公開用トークンを確認し、開発サーバーを再起動してください。';
        return;
    }

    try {
        map = new mapboxgl.Map({
            container: 'map',
            accessToken: token,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [-73.95, 40.73],
            zoom: 9.5,
        });

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.on('error', () => {
            status.textContent =
                '地図の読み込みエラー。接続・トークン・Mapboxの利用状況を確認してください。';
        });

        map.on('load', async () => {
            try {
                const response = await fetch(
                    `${import.meta.env.BASE_URL}data/nyc_2013-01-12_cst.geojson`
                );
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                if (data.type !== 'FeatureCollection' || !data.features?.length) {
                    throw new Error('GeoJSONに投稿データがありません。');
                }

                seconds = data.features
                    .map(feature => feature.properties.elapsed_seconds)
                    .sort((a, b) => a - b);

                map.addSource('tweet-data', { type: 'geojson', data });

                map.addLayer({
                    id: 'tweets',
                    type: 'circle',
                    source: 'tweet-data',
                    filter: ['==', ['get', 'elapsed_seconds'], -1],
                    paint: {
                        'circle-radius': [
                            'interpolate', ['linear'], ['zoom'],
                            8, 2,
                            13, 5,
                        ],
                        'circle-color': '#47e6c1',
                        'circle-opacity': 0.65,
                        'circle-stroke-width': 0.5,
                        'circle-stroke-color': '#c8fff3',
                    },
                });

                map.on('click', 'tweets', event => {
                    const feature = event.features?.[0];
                    if (!feature) return;

                    const text = document.createElement('p');
                    text.textContent =
                        `投稿日時（UTC）：${feature.properties.timestamp_utc}`;

                    new mapboxgl.Popup()
                        .setLngLat(feature.geometry.coordinates)
                        .setDOMContent(text)
                        .addTo(map);
                });

                update();
                controls.disabled = false;
                status.textContent =
                    `${data.features.length.toLocaleString('ja-JP')}件を読み込みました。`;
            } catch (error) {
                status.textContent = `データ読み込み失敗：${error.message}`;
            }
        });
    } catch (error) {
        status.textContent = `起動失敗：${error.message}`;
    }
}

start();