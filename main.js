import { transitData } from './transit-lines.js';
import { stationsData } from './stations.js'; // 역 데이터
import { adminData } from './admindata.js'; // admindata.js에서 데이터 가져오기
import { highspeedData } from './highspeed-lines.js'; // 고속철도 데이터
import { buildingData } from './building.js'; // building.js에서 데이터 가져오기
import { roadData } from './road.js';


// URL에서 좌표와 줌 레벨을 추출하는 함수
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const x = params.has('x') ? parseFloat(params.get('x')) : 0;
    const y = params.has('y') ? parseFloat(params.get('y')) : 0;
    const zoom = params.has('zoom') ? parseFloat(params.get('zoom')) : 6;
    return { x, y, zoom };
}

// 페이지 로드 시 지도 뷰 초기화
function initializeMap() {
    // URL에서 좌표와 줌 레벨을 추출
    const { x, y, zoom } = getUrlParams();
    console.log('Loading map at:', x, y, zoom); // 디버그용

    const projectedCenter = ol.proj.fromLonLat([x, y]);
    console.log('Projected center:', projectedCenter);

    // OpenLayers에서 사용할 지도 뷰
    const mapView = new ol.View({
        center: projectedCenter, // 변환된 좌표 사용
        zoom: zoom
    });

    // 지도 객체 생성
    const map = new ol.Map({
        target: 'map', // 지도를 표시할 HTML 요소의 id
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM() // OpenStreetMap 사용
            })
        ],
        view: mapView
    });

    // 지도의 줌이나 중심이 변경될 때마다 URL을 업데이트
    // 지도의 줌이나 중심이 변경될 때마다 URL을 업데이트
map.on('moveend', function() {
    console.log('Map moved. Updating URL...');
    
    const center = ol.proj.toLonLat(map.getView().getCenter());  // 중심 좌표 가져오기
    const currentZoom = map.getView().getZoom();  // 줌 레벨 가져오기
    console.log('New center:', center, 'Zoom level:', currentZoom);  // 디버깅용 로그 추가
    
    const newUrl = `?x=${center[0].toFixed(6)}&y=${center[1].toFixed(6)}&zoom=${currentZoom}`;
    console.log('Updated URL:', newUrl);  // 디버깅용 로그 추가
    
    window.history.replaceState({ x: center[0], y: center[1], zoom: currentZoom }, null, newUrl);  // URL 업데이트
});

}

// 페이지 로드 시 지도 초기화
window.addEventListener('load', initializeMap);

// 뒤로 가기 또는 앞으로 가기 시 지도를 다시 설정
window.addEventListener('popstate', initializeMap);



// 도로 스타일 설정 함수
function createRoadStyle(feature, zoomLevel) {
    const type = feature.get('type');
    let strokeColor, strokeWidth, textPlacement;

    switch(type) {
        case 'highway':
            strokeColor = '#DFA059';
            strokeWidth = 6;
            textPlacement = 'line';
            break;
        case 'gukdo':
            strokeColor = '#EACE70';
            strokeWidth = 6;
            textPlacement = 'line';
            break;
        case 'mainRoad':
            strokeColor = '#E1DDB7';
            strokeWidth = 6;
            textPlacement = 'line';
            break;
        case 'road':
            strokeColor = '#FFFFFF';
            strokeWidth = 4;
            textPlacement = 'line';
            break;
        case 'street':
            strokeColor = 'rgba(255, 255, 255, 0.8)';
            strokeWidth = 2;
            textPlacement = 'line';
            break;
        case 'unopened':
            strokeColor = 'rgba(0, 0, 0, 0.5)';
            strokeWidth = 4;
            textPlacement = 'line';
            break;
        default:
            strokeColor = '#000000';
            strokeWidth = 1;
            textPlacement = 'line';
    }

    // 도로 스타일 (색상 및 너비 설정)
    const roadStyle = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: strokeColor,
            width: strokeWidth
        })
    });

    // 검정 테두리 스타일 (미개통 도로 제외)
    const borderStyle = type !== 'unopened' ? new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#000000',
            width: strokeWidth + 2
        })
    }) : null;

    return [borderStyle, roadStyle].filter(style => style !== null);
}

// 도로 레이어 생성 함수
function createRoadStyleLayer(roadData, map) {
    const features = roadData.map(road => {
        const coordinates = road.coordinates.map(coord => mcToMapCoords(coord));
        const feature = new ol.Feature({
            geometry: new ol.geom.LineString(coordinates),
            name: road.name,
            zoomLevels: road.zoomLevels,
            type: road.type
        });

console.log("Feature Created:", feature); // 로그 출력

        return feature;
    });

    const layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: features
        })
    });

    // 줌 레벨 변경 시 도로 가시성 및 스타일 업데이트
    map.getView().on('change:resolution', function () {
        const zoomLevel = map.getView().getZoom();

        layer.getSource().getFeatures().forEach(feature => {
            const zoomLevels = feature.get('zoomLevels');

            if (zoomLevels.includes(zoomLevel)) {
                // 도로 스타일 적용
                feature.setStyle(createRoadStyle(feature, zoomLevel));
            } else {
                // 빈 스타일로 설정하여 도로를 숨김
                feature.setStyle(null);
            }
        });
    });

    return layer;
}

function createRoadNameStyle(feature, zoomLevel) {
    const zoomLevels = feature.get('zoomLevels');
    const type = feature.get('type');
    const name = feature.get('name');
    
    // 기본 색상과 두께 설정
    let strokeColor = '#000000'; // 기본 색상
    let strokeWidth = 2; // 기본 두께
    
    // type에 따라 색상과 두께 설정
    if (type === 'highway') {
        strokeColor = '#A86A24'; // 고속도로 색상
    }

    // 줌 레벨에 따라 도로 이름의 반복 간격 설정 (픽셀 단위로 설정)
    let repeatInterval;
    if (zoomLevel >= 8) {
        repeatInterval = 200; // 줌 레벨 8 이상: 200px 간격
    } else if (zoomLevel >= 6) {
        repeatInterval = 500; // 줌 레벨 6-7: 400px 간격
    } else {
        repeatInterval = 800; // 줌 레벨 5 이하: 600px 간격
    }

    // 도로의 길이와 좌표를 가져오기
    const coordinates = feature.getGeometry().getCoordinates();
    const length = feature.getGeometry().getLength();
    
    // 도로의 방향을 계산하는 함수
    function calculateRotation(start, end) {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        let rotation = -Math.atan2(dy, dx); // 회전 방향을 시계 방향으로 조정

        // 각도를 180도 이하로 조정
        if (rotation > Math.PI / 2 || rotation < -Math.PI / 2) {
            rotation += Math.PI; // 텍스트가 뒤집히지 않도록 회전 각도 조정
        }

        return rotation;
    }

    // 텍스트 스타일 배열
    const styles = [];
    
    // 텍스트를 일정 간격으로 반복 추가
    for (let i = 100; i < length; i += repeatInterval) {
        const point = feature.getGeometry().getCoordinateAt(i / length);
        
        // 도로의 시작과 끝 좌표를 가져와서 방향을 계산
        const startCoord = feature.getGeometry().getCoordinateAt(Math.max(i / length - 0.01, 0));
        const endCoord = feature.getGeometry().getCoordinateAt(Math.min(i / length + 0.01, 1));
        const rotation = calculateRotation(startCoord, endCoord);
        
        const textStyle = new ol.style.Text({
            text: name,
            font: 'bold 11px Arial',
            placement: 'line', // 도로를 따라가는 배치
            fill: new ol.style.Fill({
                color: '#FFFFFF' // 도로 이름 색상
            }),
            stroke: new ol.style.Stroke({
                color: strokeColor, // 설정된 색상
                width: strokeWidth // 설정된 두께
            }),
            offsetY: 0,
            rotation: rotation // 계산된 회전 각도
        });

        // 반복적으로 텍스트 스타일 추가
        styles.push(new ol.style.Style({
            geometry: new ol.geom.Point(point),
            text: textStyle
        }));
    }

    return zoomLevels.includes(zoomLevel) ? styles : [new ol.style.Style()]; // 줌 레벨에 맞지 않으면 빈 스타일로 설정
}


// 도로 이름 레이어 생성 함수
function createRoadNameLayer(roadData) {
    const features = roadData.map(road => {
        const coordinates = road.coordinates.map(coord => mcToMapCoords(coord));
        const feature = new ol.Feature({
            geometry: new ol.geom.LineString(coordinates),
            name: road.name,
            zoomLevels: road.zoomLevels,
            type: road.type
        });

        return feature;
    });

    const layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: features
        })
    });

    // 줌 레벨 변경 시 도로 이름 가시성 및 스타일 업데이트
    map.getView().on('change:resolution', function () {
        const zoomLevel = map.getView().getZoom();

        layer.getSource().getFeatures().forEach(feature => {
            const zoomLevels = feature.get('zoomLevels');

            if (zoomLevels.includes(zoomLevel)) {
                // 도로 이름 스타일 적용
                feature.setStyle(createRoadNameStyle(feature, zoomLevel));
            } else {
                // 빈 스타일로 설정하여 도로 이름을 숨김
                feature.setStyle(null);
            }
        });
    });

    return layer;
}

function updateRoadLayerVisibility(map, roadStyleLayer, roadNameLayer) {
    const zoomLevel = map.getView().getZoom();

    // 도로 스타일 레이어의 가시성 및 스타일 업데이트
    roadStyleLayer.getSource().getFeatures().forEach(feature => {
        const zoomLevels = feature.get('zoomLevels');
        if (zoomLevels.includes(zoomLevel)) {
            feature.setStyle(createRoadStyle(feature, zoomLevel));
        } else {
            // 빈 스타일을 설정하여 도로를 숨김
            feature.setStyle(new ol.style.Style());
        }
    });

    // 도로 이름 레이어의 가시성 및 스타일 업데이트
    roadNameLayer.getSource().getFeatures().forEach(feature => {
        const zoomLevels = feature.get('zoomLevels');
        if (zoomLevels.includes(zoomLevel)) {
            const style = createRoadNameStyle(feature, zoomLevel);
            console.log('Setting style for feature:', style); // 디버깅용
            feature.setStyle(style);
        } else {
            // 빈 스타일을 설정하여 도로 이름을 숨김
            feature.setStyle(new ol.style.Style());
        }
    });
}

// 업종에 따른 글씨 색상 설정 함수
function getTextColorForType(type) {
    switch(type) {
        case 'restaurant':
            return '#FF6347'; // 토마토색 (레스토랑)
        case 'office':
            return '#FFFFFF'; // 강철색 (오피스)
        case 'shop':
            return '#32CD32'; // 라임색 (상점)
        case 'parking':
            return '#FFFFFF'; // 주차장 아이콘
        case 'park':
            return '#72AE4E'; // 공원 아이콘
        case 'apt':
            return '#B08B58'; // 아파트 아이콘
        case 'school':
            return '#5394CF'; // 학교 아이콘
        case 'hamburger':
            return '#DA8C38'; // 햄버거 아이콘
        case 'busanbank':
            return '#FFFFFF'; // 부은 아이콘
        case 'starbucks':
            return '#FFFFFF'; // 햄버거 아이콘
        case 'gs25':
            return '#FFFFFF'; // gs 아이콘
        case 'church':
            return '#FFFFFF'; // gs 아이콘
        default:
            return '#FFFFFF'; // 기본 흰색
    }
}

// 업종에 따른 아이콘 경로 설정 함수
function getBuildingIconForType(type) {
    switch(type) {
        case 'restaurant':
            return 'icon/restaurant.png'; // 레스토랑 아이콘
        case 'office':
            return 'icon/office.png'; // 오피스 아이콘
        case 'shop':
            return 'icon/shop.png'; // 상점 아이콘
        case 'parking':
            return 'icon/parking.png'; // 주차장 아이콘
        case 'park':
            return 'icon/park.png'; // 공원 아이콘
        case 'apt':
            return 'icon/apt.png'; // 아파트 아이콘
        case 'school':
            return 'icon/school.png'; // 학교 아이콘
        case 'hamburger':
            return 'icon/hamburger.png'; // 햄버거 아이콘
        case 'starbucks':
            return 'icon/starbucks.png'; // 스타벅스 아이콘
        case 'busanbank':
            return 'icon/busanbank.png'; // 부은 아이콘
        case 'gs25':
            return 'icon/gs25.png'; // gs 아이콘
        case 'church':
            return 'icon/church.png'; // gs 아이콘
        default:
            return 'icon/default.png'; // 기본 아이콘
    }
}

// 줌 레벨에 따른 건물 스타일 적용 함수 (업종에 따른 아이콘 및 글씨 색상 포함)
function createBuildingStyle(building, zoomLevel) {
    const type = building.get('type');
    const iconSrc = getBuildingIconForType(type);
    const textColor = getTextColorForType(type);

    let fontSize = '12px Arial';
    let offsetY = 15;

    if (zoomLevel <= 5) {
        fontSize = 'bold 10px Arial';
        offsetY = 8;
    } else if (zoomLevel === 6) {
        fontSize = 'bold 11px Arial';
        offsetY = 8;
    } else if (zoomLevel >= 7) {
        fontSize = 'bold 11px Arial';
        offsetY = 9;
    }

    const name = building.get('name');

    return new ol.style.Style({
        image: new ol.style.Icon({
            src: iconSrc,
            scale: 0.05,
            anchor: [0.5, 0.5]
        }),
        text: new ol.style.Text({
            text: name.split('-').join('\n'), // 한 줄 띄우기
            font: fontSize,
            fill: new ol.style.Fill({
                color: textColor
            }),
            offsetY: offsetY, // 글자의 제일 위를 기준으로 오프셋 조정
            stroke: new ol.style.Stroke({
                color: '#000000',
                width: 1
            }),
            textAlign: 'center', // 텍스트 정렬 설정
            textBaseline: 'top' // 텍스트의 기준선 설정
        })
    });
}

// 건물 레이어 생성 함수 (업종 정보 추가)
function createBuildingLayer(buildingData, map) {
    const features = buildingData.map(building => {
        const coords = mcToMapCoords(building.coordinates);

        const feature = new ol.Feature({
            geometry: new ol.geom.Point(coords),
            name: building.name,
            zoomLevels: building.zoomLevels,
            type: building.type
        });

        feature.setStyle(createBuildingStyle(feature, map.getView().getZoom()));

        return feature;
    });

    const layer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: features
        })
    });

    // 줌 레벨 변경 시 건물 가시성 및 스타일 업데이트
    map.getView().on('change:resolution', function () {
        const zoomLevel = map.getView().getZoom();

        console.log('현재 줌 레벨:', zoomLevel);

        if (layer) {
            layer.getSource().getFeatures().forEach(feature => {
                const zoomLevels = feature.get('zoomLevels');

                console.log('건물:', feature.get('name'), '의 줌 레벨:', zoomLevels);
                if (zoomLevels.includes(zoomLevel)) {
                    const style = createBuildingStyle(feature, zoomLevel);
                    feature.setStyle(style);
                    console.log('스타일 적용:', feature.get('name'));
                } else {
                    // 빈 스타일로 설정하여 기본 스타일이 보이지 않도록 함
                    feature.setStyle(new ol.style.Style());
                    console.log('스타일 숨김:', feature.get('name'));
                }
            });
        } else {
            console.log('layer가 정의되지 않았습니다.');
        }
    });

    // 초기 줌 레벨에 맞는 스타일 적용
    const initialZoomLevel = map.getView().getZoom();
    layer.getSource().getFeatures().forEach(feature => {
        const zoomLevels = feature.get('zoomLevels');
        if (zoomLevels.includes(initialZoomLevel)) {
            const style = createBuildingStyle(feature, initialZoomLevel);
            feature.setStyle(style);
        } else {
            feature.setStyle(new ol.style.Style()); // 빈 스타일 적용
        }
    });

    return layer;
}
// 스타일 정의 함수
function createHighspeedLineStyleSolid(color) {
    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: color, // 실선 색상
            width: 4 // 선의 두께
        }),
        zIndex: 1
    });
}

function createHighspeedLineStyleDashed(color) {
    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: color, // 점선 색상
            width: 3,
            lineDash: [25, 25] // 픽셀 단위의 점선 간격
        }),
        zIndex: 2
    });
}

// 고속철도 노선 생성 함수
function createHighspeedLineString(coords, solidColor, dashedColor) {
    const solidLineLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: [
                new ol.Feature({
                    geometry: new ol.geom.LineString(coords)
                })
            ]
        }),
        style: createHighspeedLineStyleSolid(solidColor)
    });

    const dashedLineLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: [
                new ol.Feature({
                    geometry: new ol.geom.LineString(coords)
                })
            ]
        }),
        style: createHighspeedLineStyleDashed(dashedColor)
    });

    return new ol.layer.Group({
        layers: [solidLineLayer, dashedLineLayer]
    });
}

// 줌 레벨에 따른 스타일을 적용하는 함수 (앞서 작성한 함수 그대로)
function createAdminStyle(feature, zoomLevel) {
    let text = '';
    let fontSize = '12px Arial';
    
    if (zoomLevel <= 4) {
        if (feature.get('type') === 'city') {
            text = feature.get('name');
            fontSize = 'bold 16px Arial';
        }
    } else if (zoomLevel === 5 || zoomLevel === 6) {
        if (feature.get('type') === 'city' || feature.get('type') === 'district') {
            text = feature.get('name');
            fontSize = 'bold 16px Arial';
        }
    } else if (zoomLevel >= 7) {
        if (feature.get('type') === 'city' || feature.get('type') === 'district' || feature.get('type') === 'neighborhood') {
            text = feature.get('name');
            fontSize = 'bold 16px Arial';
        }
    }

    return new ol.style.Style({
        text: new ol.style.Text({
            text: text,
            font: fontSize,
            fill: new ol.style.Fill({
                color: '#FFFFFF'
            }),
            stroke: new ol.style.Stroke({
                color: '#000000',
                width: 1
            })
        })
    });
}

// 행정구역 레이어를 생성하는 함수
function createAdminLayer(adminData, map) {
    const features = adminData.map(area => {
        const coords = mcToMapCoords([area.x, area.z]);

        const feature = new ol.Feature({
            geometry: new ol.geom.Point(coords),
            name: area.name, // 행정구역명
            type: area.type // 행정구역 타입 (시, 구, 동)
        });

        feature.setStyle(createAdminStyle(feature, map.getView().getZoom())); // 초기 줌 레벨로 스타일 설정

        return feature;
    });

    const adminLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: features
        })
    });

    // 줌 레벨에 따라 텍스트(행정구역명) 업데이트
    map.getView().on('change:resolution', function () {
        const zoomLevel = map.getView().getZoom();

        adminLayer.getSource().getFeatures().forEach(feature => {
            const style = createAdminStyle(feature, zoomLevel);
            feature.setStyle(style); // 변경된 스타일을 적용
        });
    });

    return adminLayer;
}


// 좌표 변환 함수
function mcToMapCoords(mcCoord) {
    return [mcCoord[0], -mcCoord[1]]; // Y 좌표 반전
}

// 지도에 노선을 그릴 함수
function createLineString(coords, color) {
    return new ol.layer.Vector({
        source: new ol.source.Vector({
            features: [
                new ol.Feature({
                    geometry: new ol.geom.LineString(coords)
                })
            ]
        }),
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: color,
                width: 2
            })
        })
    });
}


// 지도에 역을 표시하는 함수
function createStationLayer(stations, map) {
    const features = stations.map(station => {
        const coords = mcToMapCoords([station.x, station.z]);

        // 기본 스타일 설정 (줌 레벨이 바뀔 때 업데이트)
        const feature = new ol.Feature({
            geometry: new ol.geom.Point(coords),
            name: station.name, // 역 이름
            line: station.line // 노선 정보
        });

        feature.setStyle(createStationStyle(feature, map.getView().getZoom())); // 초기 줌 레벨로 스타일 설정

        return feature;
    });

    const stationLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
            features: features
        })
    });

    // 줌 레벨에 따라 아이콘과 글씨 크기 변경 및 역 이름 숨기기/보이기
    map.getView().on('change:resolution', function () {
        const zoomLevel = map.getView().getZoom();

        stationLayer.getSource().getFeatures().forEach(feature => {
            const style = createStationStyle(feature, zoomLevel);
            feature.setStyle(style); // 변경된 스타일을 적용
        });
    });

    return stationLayer;
}

// 줌 레벨과 노선에 따른 아이콘 경로를 설정하는 함수
function getIconForLineZoom(line, zoomLevel) {
    let zoomSuffix;

    // 줌 레벨에 따라 아이콘의 접미사 결정
    if (zoomLevel <= 5) {
        zoomSuffix = 'A'; // 아이콘 A
    } else if (zoomLevel === 6) {
        zoomSuffix = 'B'; // 아이콘 B
    } else if (zoomLevel >= 7 && zoomLevel <= 8) {
        zoomSuffix = 'C'; // 아이콘 C
    } else {
        zoomSuffix = 'Default'; // 기본 아이콘
    }

    // 노선 값이 undefined일 때 디버깅 로그 추가
    if (!line) {
        console.warn(`Undefined line for station, using default icon.`);
    }

    // 노선이 정의되지 않았을 경우 기본 노선을 사용
    const validLine = line || 'default'; // 노선이 없으면 'default'로 설정

    // 노선에 따라 아이콘 경로 생성
    return `icon/${validLine}_${zoomSuffix}.png`; // validLine을 사용
}

// 줌 레벨에 따라 아이콘 크기를 설정하는 함수
function getIconScale(zoomLevel) {
    if (zoomLevel <= 5) {
        return 0.03; // 작은 아이콘
    } else if (zoomLevel === 6) {
        return 0.05; // 중간 아이콘
    } else if (zoomLevel === 7) {
        return 0.04; // 큰 아이콘
    } else if (zoomLevel === 8) {
        return 0.04; // 큰 아이콘
    } else {
        return 0.05; // 기본 아이콘 크기
    }
}

// 줌 레벨에 따라 다른 스타일을 적용하는 함수
function createStationStyle(station, zoomLevel) {
    const line = station.get('line'); // station.line 대신 station.get('line') 사용
    const lineColor = transitData[line]?.color || 'rgba(0, 0, 0, 0.6)'; // 노선 색상
    const iconSrc = getIconForLineZoom(line, zoomLevel); // 줌 레벨에 따른 아이콘 경로
    const scale = getIconScale(zoomLevel); // 줌 레벨에 따른 아이콘 크기
    let fontSize;
    let offsetY;

    // 줌 레벨에 따른 글씨 크기 및 텍스트 위치 설정
    if (zoomLevel <= 5) {
        fontSize = 'bold 10px Arial'; // 작은 글씨
        offsetY = 10; // 텍스트 위치 조정
    } else if (zoomLevel === 6) {
        fontSize = 'bold 12px Arial'; // 중간 글씨
        offsetY = 15;
    } else if (zoomLevel === 7) {
        fontSize = 'bold 14px Arial'; // 큰 글씨
        offsetY = 22;
    } else if (zoomLevel === 8) {
        fontSize = 'bold 14px Arial'; // 큰 글씨
        offsetY = 22;
    } else {
        fontSize = 'bold 12px Arial'; // 기본 글씨 크기
        offsetY = 15;
    }

    return new ol.style.Style({
        image: new ol.style.Icon({
            src: iconSrc,
            scale: scale, // 줌 레벨에 맞게 조정된 아이콘 크기
            anchor: [0.5, 0.5] // 아이콘 앵커 설정
        }),
        text: new ol.style.Text({
            text: station.get('name'), // station.get('name')으로 역 이름 설정
            font: fontSize,
            fill: new ol.style.Fill({
                color: '#FFFFFF' // 글씨 색: 흰색
            }),
            offsetY: offsetY, // 아이콘 아래에 텍스트 배치
            stroke: new ol.style.Stroke({
                color: lineColor, // 테두리: 노선 색상
                width: 2
            })
        })
    });
}

// 전체 노선 레이어 생성
const lineLayers = [];
for (const lineName in transitData) {
    const line = transitData[lineName];
    const coords = line.coordinates.map(mcToMapCoords);
    const lineLayer = createLineString(coords, line.color);
    lineLayers.push(lineLayer);
}

// 전체 노선을 묶는 레이어 그룹 생성
const allLinesLayerGroup = new ol.layer.Group({
    layers: lineLayers
});

// 초기 줌 레벨 설정
const initialZoomLevel = map.getView().getZoom();

// 도로 스타일 레이어 및 도로 이름 레이어 생성
const roadStyleLayer = createRoadStyleLayer(roadData, map);
const roadNameLayer = createRoadNameLayer(roadData);

map.addLayer(roadStyleLayer);
map.addLayer(roadNameLayer);

// 줌 레벨에 따라 레이어 가시성 및 스타일 업데이트
map.getView().on('change:resolution', function () {
    updateRoadLayerVisibility(map, roadStyleLayer, roadNameLayer);
});

// 초기 스타일 업데이트
updateRoadLayerVisibility(map, roadStyleLayer, roadNameLayer);



// 고속철도 노선 생성
highspeedData.forEach(line => {
    const coords = line.coordinates.map(mcToMapCoords);
    const highspeedLineLayer = createHighspeedLineString(coords, line.solidColor, line.dashedColor);
    map.addLayer(highspeedLineLayer);
});



// `initialize` 함수 정의
export function initialize(map) {
    if (!map) {
        console.error('Map object is undefined');
        return;
    }

    console.log('Map object in initialize:', map);

    // 노선 레이어 그룹을 지도에 추가
    map.addLayer(allLinesLayerGroup);

// 건물 레이어 생성 및 추가
const buildingLayer = createBuildingLayer(buildingData, map);
map.addLayer(buildingLayer);



    // 역 레이어 생성 및 지도에 추가
    const stationLayer = createStationLayer(stationsData, map);
    map.addLayer(stationLayer);

// 맵에 행정구역 레이어 추가
const adminLayer = createAdminLayer(adminData, map);
map.addLayer(adminLayer);


    // 현재 줌 레벨을 콘솔에 출력하는 함수
    const zoomLevel = map.getView().getZoom();
    console.log('Current Zoom Level:', zoomLevel);
    
    

    

// 전체 노선 및 역 표시/숨기기 버튼 이벤트 리스너
let linesVisible = true;
document.getElementById('toggleAllLines').addEventListener('click', function () {
    linesVisible = !linesVisible;
    
    // 노선 레이어 그룹과 역 레이어 모두 가시성 설정
    allLinesLayerGroup.setVisible(linesVisible);
    stationLayer.setVisible(linesVisible); // stationLayer도 함께 가시성 변경
});}

