# 시연 화면 에셋 출처와 라이선스

시연 화면(가정용 `site/`, 병상용 `ward-app/`)이 실제로 불러오는 파일만 적었습니다. 화면을 띄워 불러오는 파일을 기록하고, 코드가 이름으로 부르는 파일까지 더해 정했습니다. 아래에 없는 그림·모델은 저장소에 넣지 않았습니다.

## 외부 자료

| 파일 | 원본 | 만든 사람 | 라이선스 | 바꾼 점 |
| --- | --- | --- | --- | --- |
| `site/assets/ClearDaySky.jpg`, `ward-app/public/ClearDaySky.jpg` | [Kloofendal 48d Partly Cloudy (Pure Sky)](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky), Poly Haven | Greg Zaal, Jarod Guest | CC0 | 4K HDR을 받아 하늘 파란색·구름 밝기를 보정하고 4096×2048 JPG로 저장 |
| `ward-app/public/CityParkSky.jpg` | [Docklands 02](https://polyhaven.com/a/docklands_02), Poly Haven | Savva Zakharov | CC0 | 강 쪽 148도만 남기고 나머지는 좌우 뒤집어 채움, 가로등 3개 지움, 하늘을 `ClearDaySky`로 바꿈 |
| `ward-app/public/hdri/room.hdr` | [Small Empty Room 3](https://polyhaven.com/a/small_empty_room_3) 2K HDR, Poly Haven | Sergej Majboroda | CC0 | 없음(파일 이름만 바꿈, 원본과 MD5 같음) |
| `site/assets/view.jpg`, `site/assets/park/city-prague.webp` | ["Praha Panorama from Petřín 20170430"](https://commons.wikimedia.org/wiki/File:Praha_Panorama_from_Pet%C5%99%C3%AD%C5%88_20170430.jpg), Wikimedia Commons | Uoaei1 | **CC BY-SA 4.0** | 잘라 내고 색을 맞춤. **이 두 파일은 CC BY-SA 4.0으로 배포합니다.** 다른 파일과 코드에는 해당하지 않습니다 |
| `site/assets/modern_arm_chair_01.glb`, `modern_arm_chair_01_legs.jpg`(가정용·병상용) | [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01), Poly Haven | Vibrant Nordic | CC0 | 웹용으로 줄임 |
| `site/assets/potted_plant_02.glb`, `potted_plant_02_*.jpg` | [Potted Plant 02](https://polyhaven.com/a/potted_plant_02), Poly Haven | Rico Cilliers | CC0 | 웹용으로 줄임 |
| `waffle_pique_cotton_*.jpg`, `wool_boucle_nor.jpg`, `jersey_melange_nor.jpg`(가정용 `site/assets/`, 병상용 `ward-app/public/tex3d/`) | [Waffle Pique Cotton](https://polyhaven.com/a/waffle_pique_cotton), [Wool Boucle](https://polyhaven.com/a/wool_boucle), [Jersey Melange](https://polyhaven.com/a/jersey_melange), Poly Haven | colormass, Rico Cilliers | CC0 | 크기 줄임 |
| `ward-app/public/tex3d/laminate_floor_02_*.jpg`, `floor_diff.jpg` | [Laminate Floor 02](https://polyhaven.com/a/laminate_floor_02), Poly Haven | Dario Barresi, Charlotte Baglioni | CC0 | 크기 줄임 |
| `site/assets/M_Floor.jpg` | [Laminate Floor 02](https://polyhaven.com/a/laminate_floor_02), Poly Haven | Dario Barresi, Charlotte Baglioni | CC0 | 2K 원본을 1024px로 줄이고 대비 0.8, 색 보정 |
| `site/assets/M_Wall.jpg` | [Plastered Wall](https://polyhaven.com/a/plastered_wall), Poly Haven | Amal Kumar | CC0 | 2K 원본을 1024px로 줄이고 흰색과 섞어 대비 0.1, 따뜻한 색 보정 |
| `site/assets/M_Curtain.jpg` | [Rough Linen](https://polyhaven.com/a/rough_linen), Poly Haven | colormass, Rico Cilliers | CC0 | 2K 원본을 1024px로 줄이고 흰색과 섞어 대비 0.12, 베이지 계열 보정 |
| `site/assets/M_Rug.jpg` | [Curly Teddy Natural](https://polyhaven.com/a/curly_teddy_natural), Poly Haven | colormass, Rico Cilliers | CC0 | 2K 원본을 1024px로 줄이고 따뜻한 크림색 보정 |
| `site/assets/M_Walnut.jpg` | [White Oak Veneer](https://polyhaven.com/a/white_oak_veneer), Poly Haven | Jenelle van Heerden | CC0 | 2K 원본을 1024px로 줄이고 짙은 갈색 보정(파일 이름은 Walnut이지만 원본은 오크 무늬) |
| `site/assets/p_boucle.jpg` | [Wool Boucle](https://polyhaven.com/a/wool_boucle), Poly Haven | colormass, Rico Cilliers | CC0 | 원본 질감의 명암을 뽑아 무늬 대비를 낮추고 베이지(`#e4d8c6`)로 색을 맞춘 가공본 |
| `site/assets/p_knit.jpg` | [Jersey Melange](https://polyhaven.com/a/jersey_melange), Poly Haven | colormass, Rico Cilliers | CC0 | 원본 질감의 명암을 뽑아 무늬 대비를 조정하고 회갈색(`#7d7873`)으로 색을 맞춘 가공본 |
| `site/assets/p_top.jpg`, `p_pillow.jpg` | [Waffle Pique Cotton](https://polyhaven.com/a/waffle_pique_cotton), Poly Haven | colormass, Rico Cilliers | CC0 | 원본 질감의 명암을 뽑아 무늬 대비를 낮추고 크림색(`p_top` `#f1ece2`, `p_pillow` `#f3efe7`)으로 색을 맞춘 가공본. 원본 하나로 두 파일을 만듦 |
| `park/paving_diff.jpg`(가정용·병상용) | [Concrete Tiles 02](https://polyhaven.com/a/concrete_tiles_02), Poly Haven | Charlotte Baglioni | CC0 | 크기 줄임 |
| `park/island_tree_0*_*.webp`, `jacaranda_tree_*.webp`, `tree_small_02_*.webp`, `shrub_01_*.webp`, `shrub_04_*.webp`(가정용·병상용) | [Island Tree 01·02·03](https://polyhaven.com/a/island_tree_01), [Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree), [Tree Small 02](https://polyhaven.com/a/tree_small_02), [Shrub 01](https://polyhaven.com/a/shrub_01), [Shrub 04](https://polyhaven.com/a/shrub_04), Poly Haven | Rob Tuytel, Rico Cilliers | CC0 | Blender에서 네 방향으로 렌더해 그림으로 만듦 |
| `site/assets/park/bed_*.jpg`, `ward-app/public/park/clump_*.webp` | [Flower Gazania](https://polyhaven.com/a/flower_gazania), [Flower Empodium](https://polyhaven.com/a/flower_empodium), [Celandine 01](https://polyhaven.com/a/celandine_01), Poly Haven | James Ray Cock, Jenelle van Heerden, Rob Tuytel, Rico Cilliers | CC0 | Blender에서 꽃포기로 모아 렌더, 꽃 색을 빨강·노랑으로 바꿈 |
| `ward-app/public/fruit/apple.png`, `grape.png`, `strawberry.png` | [Noto Emoji](https://github.com/googlefonts/noto-emoji) `3D/png/512` | Google | Apache 2.0 | 없음(파일 이름만 바꿈). 전문 `fruit/LICENSE-Apache-2.0.txt`, 고지 `fruit/NOTICE.txt` |
| `site/fonts/Pretendard-*.woff2` | [Pretendard](https://github.com/orioncactus/pretendard) | Kil Hyung-jin | SIL OFL 1.1 | 없음. 전문 `site/fonts/Pretendard-License.txt` |
| `site/fonts/NanumPenScript-Regular.ttf`, `ward-app/public/tag-pen.ttf` | 나눔손글씨 펜 | NHN | SIL OFL 1.1 | 없음(`tag-pen.ttf`는 파일 이름만 바꿈). 전문 `Nanum-Pen-License.txt` |
| `ward-app/public/brand.ttf`, `loading-pen.ttf` | 나눔손글씨 펜 | NHN | SIL OFL 1.1 | 화면에 쓰는 글자만 남긴 일부. OFL 예약 이름 규칙에 따라 글꼴 이름을 `Jaljayo Pen Brand`, `Jaljayo Pen Loading`으로 바꿈 |
| `site/assets/three/` | [three.js](https://github.com/mrdoob/three.js) r160 | three.js authors | MIT | 필요한 파일만 넣음. 전문 `site/assets/three/LICENSE` |
| 병상용 빌드에 묶이는 라이브러리(react, three, @react-three/fiber·drei·postprocessing 등 70개) | npm | 각 저작자 | MIT 등 | 전문 `ward-app/public/THIRD_PARTY_LICENSES.txt`(빌드 결과에도 같이 들어감) |

## 팀이 직접 만든 것

| 파일 | 내용 |
| --- | --- |
| `site/assets/suite.glb`, `hollow-frame.glb`, `tea-table.glb` | 가정용 방(Unreal에서 만든 장면을 내보냄). 질감은 위 Poly Haven 재질 |
| `site/assets/quilt-surface.glb`, `TerraceBistro.glb` | 침대 이불 면, 창가 가구 묶음(Blender). 질감은 위 Poly Haven 재질 |
| `ward-app/public/clinical-ward.glb`, `entry.glb`, `models/ward_room.glb`, `models/zinus_room.glb` | 병실과 움직이는 침대(Blender) |
| `ward-app/public/ward_photo.jpg`, `logo.png`, `logo.svg`, `site/fig-moon.svg` | 병실 렌더 사진, 로고 |
| 모터 소리 | 코드로 합성(`site/console/motor.js`), 녹음 파일 없음 |
