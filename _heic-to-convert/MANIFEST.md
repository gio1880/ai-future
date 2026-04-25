# HEIC quarantine manifest

Every `.heic` / `.HEIC` file in the project has been moved into this folder.
Browsers (other than Safari) cannot render HEIC, so these images would never display on the site.

## How to use
1. Convert every file in this folder to **`.jpg`** (or `.webp`) using one of:
   - macOS Finder: select all → right-click → Quick Actions → Convert Image → JPEG
   - Windows: drag into <https://convertio.co/heic-jpg/> or `magick mogrify -format jpg *.heic`
   - CLI: `for f in *.heic; do magick "$f" "${f%.heic}.jpg"; done`
2. Copy the converted `.jpg` files back to the **Original Path** column shown below.
3. Delete this `_heic-to-convert` folder once everything is converted.

| # | New filename | Size | Original path |
|---|---|---|---|
| 1 | `robotics_lab__25_summer_pictures__IMG_1780.heic` | 1.5 MB | `robotics lab/25_summer_pictures/IMG_1780.heic` |
| 2 | `robotics_lab__25_summer_pictures__IMG_1799.heic` | 1.6 MB | `robotics lab/25_summer_pictures/IMG_1799.heic` |
| 3 | `robotics_lab__25_summer_pictures__IMG_1816.HEIC` | 1.9 MB | `robotics lab/25_summer_pictures/IMG_1816.HEIC` |
| 4 | `robotics_lab__25_summer_pictures__IMG_7448.heic` | 966 KB | `robotics lab/25_summer_pictures/IMG_7448.heic` |
| 5 | `robotics_lab__25_summer_pictures__IMG_7450.heic` | 804 KB | `robotics lab/25_summer_pictures/IMG_7450.heic` |
| 6 | `robotics_lab__25_summer_pictures__IMG_7622.heic` | 1.6 MB | `robotics lab/25_summer_pictures/IMG_7622.heic` |
| 7 | `robotics_lab__25_summer_pictures__IMG_7625.heic` | 1.1 MB | `robotics lab/25_summer_pictures/IMG_7625.heic` |
| 8 | `robotics_lab__25_summer_pictures__IMG_7926.heic` | 1.7 MB | `robotics lab/25_summer_pictures/IMG_7926.heic` |
| 9 | `robotics_lab__25_summer_pictures__IMG_8129.heic` | 2.0 MB | `robotics lab/25_summer_pictures/IMG_8129.heic` |
| 10 | `robotics_lab__25_summer_pictures__IMG_8160.heic` | 1.9 MB | `robotics lab/25_summer_pictures/IMG_8160.heic` |
| 11 | `robotics_lab__25_summer_pictures__IMG_8195.heic` | 1.5 MB | `robotics lab/25_summer_pictures/IMG_8195.heic` |
| 12 | `robotics_lab__25_summer_pictures__IMG_8200.heic` | 1.7 MB | `robotics lab/25_summer_pictures/IMG_8200.heic` |
| 13 | `robotics_lab__25_summer_pictures__IMG_8316.heic` | 1.3 MB | `robotics lab/25_summer_pictures/IMG_8316.heic` |
| 14 | `robotics_lab__25_summer_pictures__IMG_9516_(1).heic` | 1.1 MB | `robotics lab/25_summer_pictures/IMG_9516 (1).heic` |
| 15 | `robotics_lab__25_summer_pictures__Photos_(17)__E76A773E-17E6-465C-A79D-8C129BFF6B3D.heic` | 1.2 MB | `robotics lab/25_summer_pictures/Photos (17)/E76A773E-17E6-465C-A79D-8C129BFF6B3D.heic` |
| 16 | `robotics_lab__25_summer_pictures__Photos_(18)__AFFA218F-0A6A-4597-88BF-79EAA8C891BB.heic` | 1.1 MB | `robotics lab/25_summer_pictures/Photos (18)/AFFA218F-0A6A-4597-88BF-79EAA8C891BB.heic` |
| 17 | `robotics_lab__25_summer_pictures__Photos_(19)__88042E53-06F1-427D-9BAF-9C54AEB1BC61.heic` | 1.4 MB | `robotics lab/25_summer_pictures/Photos (19)/88042E53-06F1-427D-9BAF-9C54AEB1BC61.heic` |
| 18 | `robotics_lab__25_summer_pictures__Photos_(20)__94FFFBAD-87C5-4D9D-8610-FBD77B47D476.heic` | 1.2 MB | `robotics lab/25_summer_pictures/Photos (20)/94FFFBAD-87C5-4D9D-8610-FBD77B47D476.heic` |
| 19 | `robotics_lab__25_summer_pictures__Photos_(21)__AA68DDD0-8414-4DED-A714-320D06960DC9.heic` | 1.2 MB | `robotics lab/25_summer_pictures/Photos (21)/AA68DDD0-8414-4DED-A714-320D06960DC9.heic` |
| 20 | `robotics_lab__25_summer_pictures__Photos_(22)__EFE517AC-F0A5-4DD2-9B14-474772DB5169.heic` | 955 KB | `robotics lab/25_summer_pictures/Photos (22)/EFE517AC-F0A5-4DD2-9B14-474772DB5169.heic` |
| 21 | `robotics_lab__25_summer_pictures__Photos_(23)__7C8F5EEB-86C5-444A-BF28-920135CABB4C.heic` | 690 KB | `robotics lab/25_summer_pictures/Photos (23)/7C8F5EEB-86C5-444A-BF28-920135CABB4C.heic` |
| 22 | `robotics_lab__25_summer_pictures__Photos_(24)__7C8F5EEB-86C5-444A-BF28-920135CABB4C.heic` | 845 KB | `robotics lab/25_summer_pictures/Photos (24)/7C8F5EEB-86C5-444A-BF28-920135CABB4C.heic` |
| 23 | `robotics_lab__25_summer_pictures__Photos_(25)__E3D59125-E0C0-4A54-BAD1-90F1BF21E659.heic` | 933 KB | `robotics lab/25_summer_pictures/Photos (25)/E3D59125-E0C0-4A54-BAD1-90F1BF21E659.heic` |
| 24 | `robotics_lab__25_summer_pictures__Photos_(26)__E5195D58-5598-4311-B9F3-40EF85399102.heic` | 1.0 MB | `robotics lab/25_summer_pictures/Photos (26)/E5195D58-5598-4311-B9F3-40EF85399102.heic` |
| 25 | `robotics_lab__25_summer_pictures__Photos_(9)__1B49F68A-9300-4625-92D4-184416D5A282.heic` | 3.3 MB | `robotics lab/25_summer_pictures/Photos (9)/1B49F68A-9300-4625-92D4-184416D5A282.heic` |
| 26 | `robotics_lab__25_summer_pictures__Photos-3-001_(1)__00D7F78C-1079-4A68-ABCF-2CF399FEBD73.HEIC` | 876 KB | `robotics lab/25_summer_pictures/Photos-3-001 (1)/00D7F78C-1079-4A68-ABCF-2CF399FEBD73.HEIC` |
| 27 | `robotics_lab__25_summer_pictures__Photos-3-001_(1)__2FFDE247-58E9-4CB9-B186-F2F3FE5CF47E.HEIC` | 839 KB | `robotics lab/25_summer_pictures/Photos-3-001 (1)/2FFDE247-58E9-4CB9-B186-F2F3FE5CF47E.HEIC` |
| 28 | `robotics_lab__FLL_Teams__16380574-824C-4389-AD74-353F51A10273.heic` | 226 KB | `robotics lab/FLL Teams/16380574-824C-4389-AD74-353F51A10273.heic` |
| 29 | `robotics_lab__FLL_Teams__1d05c7db813baf248fe816bab4916684.heic` | 131 KB | `robotics lab/FLL Teams/1d05c7db813baf248fe816bab4916684.heic` |
| 30 | `robotics_lab__FLL_Teams__24_25_season_pictures__16380574-824C-4389-AD74-353F51A10273.heic` | 226 KB | `robotics lab/FLL Teams/24_25_season_pictures/16380574-824C-4389-AD74-353F51A10273.heic` |
| 31 | `robotics_lab__FLL_Teams__24_25_season_pictures__1d05c7db813baf248fe816bab4916684.heic` | 131 KB | `robotics lab/FLL Teams/24_25_season_pictures/1d05c7db813baf248fe816bab4916684.heic` |
| 32 | `robotics_lab__FLL_Teams__24_25_season_pictures__2A35BBD2-322A-4261-98A5-00407C2C2BF9.heic` | 336 KB | `robotics lab/FLL Teams/24_25_season_pictures/2A35BBD2-322A-4261-98A5-00407C2C2BF9.heic` |
| 33 | `robotics_lab__FLL_Teams__24_25_season_pictures__554fb00e8c176ad5c58ec9d0529cd65f.heic` | 1.4 MB | `robotics lab/FLL Teams/24_25_season_pictures/554fb00e8c176ad5c58ec9d0529cd65f.heic` |
| 34 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_0245.heic` | 1.7 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_0245.heic` |
| 35 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_0247.heic` | 1.5 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_0247.heic` |
| 36 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_0267.heic` | 1.7 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_0267.heic` |
| 37 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_0297.heic` | 1.9 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_0297.heic` |
| 38 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_0499.heic` | 2.4 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_0499.heic` |
| 39 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_0679.heic` | 1.8 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_0679.heic` |
| 40 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_0921.heic` | 1.8 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_0921.heic` |
| 41 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_0933.heic` | 1.7 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_0933.heic` |
| 42 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_2213.heic` | 1.2 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_2213.heic` |
| 43 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_2304.heic` | 1.9 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_2304.heic` |
| 44 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_2865.heic` | 1.3 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_2865.heic` |
| 45 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_9321.heic` | 1.3 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_9321.heic` |
| 46 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_9346.heic` | 1.7 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_9346.heic` |
| 47 | `robotics_lab__FLL_Teams__24_25_season_pictures__IMG_9347.heic` | 2.4 MB | `robotics lab/FLL Teams/24_25_season_pictures/IMG_9347.heic` |
| 48 | `robotics_lab__FLL_Teams__24_25_season_pictures__originalImage_2481749940_livephoto.heic` | 356 KB | `robotics lab/FLL Teams/24_25_season_pictures/originalImage_2481749940_livephoto.heic` |
| 49 | `robotics_lab__FLL_Teams__24_25_season_pictures__Photos__IMG_2884.heic` | 1.3 MB | `robotics lab/FLL Teams/24_25_season_pictures/Photos/IMG_2884.heic` |
| 50 | `robotics_lab__FLL_Teams__25_26_season_pictures__IMG_2963_(1).heic` | 3.0 MB | `robotics lab/FLL Teams/25_26_season_pictures/IMG_2963 (1).heic` |
| 51 | `robotics_lab__FLL_Teams__25_26_season_pictures__IMG_2966.heic` | 2.3 MB | `robotics lab/FLL Teams/25_26_season_pictures/IMG_2966.heic` |
| 52 | `robotics_lab__FLL_Teams__25_26_season_pictures__IMG_2968.heic` | 1.2 MB | `robotics lab/FLL Teams/25_26_season_pictures/IMG_2968.heic` |
| 53 | `robotics_lab__FLL_Teams__25_26_season_pictures__IMG_2969.heic` | 2.1 MB | `robotics lab/FLL Teams/25_26_season_pictures/IMG_2969.heic` |
| 54 | `robotics_lab__FLL_Teams__25_26_season_pictures__IMG_2983.heic` | 2.4 MB | `robotics lab/FLL Teams/25_26_season_pictures/IMG_2983.heic` |
| 55 | `robotics_lab__FLL_Teams__IMG_5058.heic` | 1.2 MB | `robotics lab/FLL Teams/IMG_5058.heic` |
| 56 | `robotics_lab__FLL_Teams__IMG_5065.heic` | 814 KB | `robotics lab/FLL Teams/IMG_5065.heic` |
| 57 | `robotics_lab__FLL_Teams__IMG_5070.heic` | 1.7 MB | `robotics lab/FLL Teams/IMG_5070.heic` |
| 58 | `robotics_lab__FLL_Teams__nyc_champs_3rd_place_robot_performance.heic` | 336 KB | `robotics lab/FLL Teams/nyc champs 3rd place robot performance.heic` |
| 59 | `robotics_lab__FLL_Teams__originalImage_2481749940_livephoto.heic` | 356 KB | `robotics lab/FLL Teams/originalImage_2481749940_livephoto.heic` |
| 60 | `robotics_lab__FTC_Pictures__ftc_25_26_pictures__IMG_2791.heic` | 1.8 MB | `robotics lab/FTC Pictures/ftc_25_26_pictures/IMG_2791.heic` |
| 61 | `robotics_lab__FTC_Pictures__ftc_25_26_pictures__IMG_2792.heic` | 2.2 MB | `robotics lab/FTC Pictures/ftc_25_26_pictures/IMG_2792.heic` |
| 62 | `robotics_lab__FTC_Pictures__ftc_25_26_pictures__IMG_2793.heic` | 1.8 MB | `robotics lab/FTC Pictures/ftc_25_26_pictures/IMG_2793.heic` |
| 63 | `robotics_lab__FTC_Pictures__ftc_25_26_pictures__IMG_2844.heic` | 1.9 MB | `robotics lab/FTC Pictures/ftc_25_26_pictures/IMG_2844.heic` |
| 64 | `robotics_lab__FTC_Pictures__ftc_25_26_pictures__IMG_2998.heic` | 2.3 MB | `robotics lab/FTC Pictures/ftc_25_26_pictures/IMG_2998.heic` |
| 65 | `robotics_lab__FTC_Pictures__ftc_25_26_pictures__IMG_3001.heic` | 3.1 MB | `robotics lab/FTC Pictures/ftc_25_26_pictures/IMG_3001.heic` |
| 66 | `robotics_lab__FTC_Pictures__ftc_25_26_pictures__IMG_3030.heic` | 1.1 MB | `robotics lab/FTC Pictures/ftc_25_26_pictures/IMG_3030.heic` |
| 67 | `robotics_lab__FTC_Pictures__ftc_25_26_pictures__IMG_3102.heic` | 2.4 MB | `robotics lab/FTC Pictures/ftc_25_26_pictures/IMG_3102.heic` |
| 68 | `robotics_lab__FTC_Pictures__ftc_25_26_pictures__IMG_3144.heic` | 2.7 MB | `robotics lab/FTC Pictures/ftc_25_26_pictures/IMG_3144.heic` |

**Total: 68 files, 99.0 MB**

