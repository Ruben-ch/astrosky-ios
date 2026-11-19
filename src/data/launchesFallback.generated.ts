// ⚠️ Fichier généré automatiquement — ne pas éditer à la main (scripts/gen-space-fallback.mjs).
// Source : The Space Devs — Launch Library 2 (/2.2.0/launch/upcoming/), 30 lancements.
import type { Ll2LaunchRaw } from '../types/space'

/** Date du relevé des lancements embarqués. */
export const BUNDLED_LAUNCHES_FETCHED_AT = Date.parse("2026-11-18T15:14:48.910Z")

/** Réponse Launch Library 2 réduite, analysée à l'exécution comme une réponse réseau. */
export const BUNDLED_LAUNCHES_RAW: readonly Ll2LaunchRaw[] = [
  {
    "id": "e0a11eb1-0bda-4872-b36b-140247fd5c60",
    "name": "Long March 2D | Unknown Payload",
    "net": "2026-11-18T22:50:00Z",
    "window_start": "2026-11-18T22:43:00Z",
    "window_end": "2026-11-18T23:05:00Z",
    "net_precision": {
      "name": "Hour",
      "abbrev": "HR"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/long2520march25202d_image_20190222031211.jpeg",
    "status": {
      "abbrev": "Go",
      "name": "Go for Launch",
      "description": "Current T-0 confirmed by official or reliable sources."
    },
    "launch_service_provider": {
      "name": "China Aerospace Science and Technology Corporation",
      "type": "Government"
    },
    "rocket": {
      "configuration": {
        "name": "Long March 2D",
        "family": "Long March",
        "full_name": "Long March 2D",
        "variant": "D"
      }
    },
    "mission": {
      "name": "Unknown Payload",
      "description": "Details TBD.",
      "type": "Unknown",
      "orbit": {
        "name": "Unknown",
        "abbrev": "N/A"
      }
    },
    "pad": {
      "name": "Launch Complex 9",
      "latitude": "38.863128",
      "longitude": "111.589567",
      "location": {
        "name": "Taiyuan Satellite Launch Center, People's Republic of China",
        "country_code": "CHN"
      }
    }
  },
  {
    "id": "76617033-4dc0-4448-b50c-e5b0d5a18539",
    "name": "Falcon 9 Block 5 | USSF-317",
    "net": "2026-11-20T02:46:00Z",
    "window_start": "2026-11-20T02:46:00Z",
    "window_end": "2026-11-20T06:46:00Z",
    "net_precision": {
      "name": "Minute",
      "abbrev": "MIN"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/falcon_9_liftof_image_20260816171423.jpg",
    "status": {
      "abbrev": "Go",
      "name": "Go for Launch",
      "description": "Current T-0 confirmed by official or reliable sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "USSF-317",
      "description": "A classified mission for the United States Space Force. It is possibly a batch of classified LEO satellites based on SpaceX’s Starshield satellite bus, based on locations of rocket stage drop zones being exact fits with previous Starlink Group 15 launches.",
      "type": "Government/Top Secret",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Space Launch Complex 4E",
      "latitude": "34.632",
      "longitude": "-120.611",
      "location": {
        "name": "Vandenberg SFB, CA, USA",
        "country_code": "USA"
      }
    }
  },
  {
    "id": "a2975167-7c6f-4403-99e1-b40df17c8140",
    "name": "Long March 8A | SatNet LEO Group TBD?",
    "net": "2026-11-20T11:59:00Z",
    "window_start": "2026-11-20T11:51:00Z",
    "window_end": "2026-11-20T12:17:00Z",
    "net_precision": {
      "name": "Hour",
      "abbrev": "HR"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/cz-8a_launch_2_image_20251206093107.jpeg",
    "status": {
      "abbrev": "Go",
      "name": "Go for Launch",
      "description": "Current T-0 confirmed by official or reliable sources."
    },
    "launch_service_provider": {
      "name": "China Aerospace Science and Technology Corporation",
      "type": "Government"
    },
    "rocket": {
      "configuration": {
        "name": "Long March 8A",
        "family": "Long March",
        "full_name": "Long March 8A",
        "variant": "A"
      }
    },
    "mission": {
      "name": "SatNet LEO Group TBD?",
      "description": "A batch of 9 Low Earth Orbit communication satellites for the Chinese state owned SatNet constellation operated by the China Satellite Network Group.\r\n\r\nThe constellation will eventually consists of 13000 satellites.",
      "type": "Communications",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Commercial LC-1",
      "latitude": "19.597275",
      "longitude": "110.930753",
      "location": {
        "name": "Wenchang Space Launch Site, People's Republic of China",
        "country_code": "CHN"
      }
    }
  },
  {
    "id": "13270554-4bdb-42ae-916f-1bb54492204f",
    "name": "Long March 6C | Unknown Payload",
    "net": "2026-11-21T03:50:00Z",
    "window_start": "2026-11-21T03:46:00Z",
    "window_end": "2026-11-21T04:15:00Z",
    "net_precision": {
      "name": "Hour",
      "abbrev": "HR"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/cz-6c_on_the_la_image_20240507065151.jpg",
    "status": {
      "abbrev": "Go",
      "name": "Go for Launch",
      "description": "Current T-0 confirmed by official or reliable sources."
    },
    "launch_service_provider": {
      "name": "China Aerospace Science and Technology Corporation",
      "type": "Government"
    },
    "rocket": {
      "configuration": {
        "name": "Long March 6C",
        "family": "Long March",
        "full_name": "Long March 6C",
        "variant": "C"
      }
    },
    "mission": {
      "name": "Unknown Payload",
      "description": "Details TBD.",
      "type": "Unknown",
      "orbit": {
        "name": "Unknown",
        "abbrev": "N/A"
      }
    },
    "pad": {
      "name": "Launch Complex 9A",
      "latitude": "38.8583",
      "longitude": "111.5802",
      "location": {
        "name": "Taiyuan Satellite Launch Center, People's Republic of China",
        "country_code": "CHN"
      }
    }
  },
  {
    "id": "951a341f-236b-42fe-a667-4ab2fcf36eac",
    "name": "Falcon 9 Block 5 | NROL-136",
    "net": "2026-11-21T12:30:00Z",
    "window_start": "2026-11-21T12:30:00Z",
    "window_end": "2026-11-21T13:00:00Z",
    "net_precision": {
      "name": "Minute",
      "abbrev": "MIN"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/falcon_9_on_slc_image_20241024165956.jpg",
    "status": {
      "abbrev": "Go",
      "name": "Go for Launch",
      "description": "Current T-0 confirmed by official or reliable sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "NROL-136",
      "description": "Fifteenth batch of satellites for a reconnaissance satellite constellation built by SpaceX and Northrop Grumman for the National Reconnaissance Office to provide imaging and other reconnaissance capabilities.",
      "type": "Government/Top Secret",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Space Launch Complex 4E",
      "latitude": "34.632",
      "longitude": "-120.611",
      "location": {
        "name": "Vandenberg SFB, CA, USA",
        "country_code": "USA"
      }
    }
  },
  {
    "id": "7bdc412b-c965-4517-a131-f57a01189803",
    "name": "Ariane 64 Block 2 | Amazon Leo (LE-04)",
    "net": "2026-11-23T11:09:00Z",
    "window_start": "2026-11-23T11:09:00Z",
    "window_end": "2026-11-23T11:38:00Z",
    "net_precision": {
      "name": "Minute",
      "abbrev": "MIN"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/ariane_64_lifto_image_20260618063419.jpg",
    "status": {
      "abbrev": "Go",
      "name": "Go for Launch",
      "description": "Current T-0 confirmed by official or reliable sources."
    },
    "launch_service_provider": {
      "name": "Arianespace",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Ariane 64",
        "family": "Ariane",
        "full_name": "Ariane 64 Block 2",
        "variant": "64 Block 2"
      }
    },
    "mission": {
      "name": "Amazon Leo (LE-04)",
      "description": "Amazon Leo, formerly known as Project Kuiper, is a mega constellation of satellites in Low Earth Orbit that will offer broadband internet access, this constellation will be managed by Kuiper Systems LLC, a subsidiary of Amazon. This constellation is planned to be composed of 3,276 satellites. The satellites are projected to be placed in 98 orbital planes in three orbital layers, one at 590 km, 610 km and 630 km altitude.\r\n\r\n35-40 satellites will be carried on each Ariane 6 launch.",
      "type": "Communications",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Ariane Launch Area 4",
      "latitude": "5.256319",
      "longitude": "-52.786838",
      "location": {
        "name": "Guiana Space Centre, French Guiana",
        "country_code": "GUF"
      }
    }
  },
  {
    "id": "460d9db7-eaf6-4cd9-b095-cff433534c09",
    "name": "Falcon 9 Block 5 | USSF-266",
    "net": "2026-11-23T16:04:00Z",
    "window_start": "2026-11-23T16:04:00Z",
    "window_end": "2026-11-23T20:04:00Z",
    "net_precision": {
      "name": "Minute",
      "abbrev": "MIN"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/falcon_9_liftof_image_20260816171423.jpg",
    "status": {
      "abbrev": "Go",
      "name": "Go for Launch",
      "description": "Current T-0 confirmed by official or reliable sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "USSF-266",
      "description": "A classified mission for the United States Space Force. It is possibly a batch of classified LEO satellites based on SpaceX’s Starshield satellite bus, based on locations of ascent rocket stage drop zones being fits with previous SDA Transport Layer launches.",
      "type": "Government/Top Secret",
      "orbit": {
        "name": "Polar Orbit",
        "abbrev": "PO"
      }
    },
    "pad": {
      "name": "Space Launch Complex 4E",
      "latitude": "34.632",
      "longitude": "-120.611",
      "location": {
        "name": "Vandenberg SFB, CA, USA",
        "country_code": "USA"
      }
    }
  },
  {
    "id": "8dd5de11-831b-445f-86f0-bffefe0550d9",
    "name": "Soyuz 2.1b | Progress MS-36 (97P)",
    "net": "2026-11-24T05:03:00Z",
    "window_start": "2026-11-24T05:03:00Z",
    "window_end": "2026-11-24T05:03:00Z",
    "net_precision": {
      "name": "Minute",
      "abbrev": "MIN"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/soyuz_2.1b_image_20230802085331.jpg",
    "status": {
      "abbrev": "TBC",
      "name": "To Be Confirmed",
      "description": "Awaiting official confirmation - current date is known with some certainty."
    },
    "launch_service_provider": {
      "name": "Russian Federal Space Agency (ROSCOSMOS)",
      "type": "Government"
    },
    "rocket": {
      "configuration": {
        "name": "Soyuz 2.1b",
        "family": "Soyuz",
        "full_name": "Soyuz 2.1b",
        "variant": ""
      }
    },
    "mission": {
      "name": "Progress MS-36 (97P)",
      "description": "Progress resupply mission to the International Space Station.",
      "type": "Resupply",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "31/6",
      "latitude": "45.996034",
      "longitude": "63.564003",
      "location": {
        "name": "Baikonur Cosmodrome, Republic of Kazakhstan",
        "country_code": "KAZ"
      }
    }
  },
  {
    "id": "5ce59e3a-c343-430f-ae4e-e608ba536754",
    "name": "Long March 12 | SatNet LEO Group TBD?",
    "net": "2026-11-24T07:00:00Z",
    "window_start": "2026-11-24T07:00:00Z",
    "window_end": "2026-11-24T10:00:00Z",
    "net_precision": {
      "name": "Hour",
      "abbrev": "HR"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/cz-12_on_its_la_image_20241128132937.jpg",
    "status": {
      "abbrev": "TBC",
      "name": "To Be Confirmed",
      "description": "Awaiting official confirmation - current date is known with some certainty."
    },
    "launch_service_provider": {
      "name": "China Aerospace Science and Technology Corporation",
      "type": "Government"
    },
    "rocket": {
      "configuration": {
        "name": "Long March 12",
        "family": "Long March",
        "full_name": "Long March 12",
        "variant": ""
      }
    },
    "mission": {
      "name": "SatNet LEO Group TBD?",
      "description": "A batch of 9 Low Earth Orbit communication satellites for the Chinese state owned SatNet constellation operated by the China Satellite Network Group.\r\n\r\nThe constellation will eventually consists of 13000 satellites.",
      "type": "Communications",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Commercial LC-2",
      "latitude": "19.59755",
      "longitude": "110.936481",
      "location": {
        "name": "Wenchang Space Launch Site, People's Republic of China",
        "country_code": "CHN"
      }
    }
  },
  {
    "id": "c9605b67-8a53-4239-a8ae-577fe3b79799",
    "name": "Long March 2F/G | Shenzhou 24",
    "net": "2026-11-25T00:00:00Z",
    "window_start": "2026-11-25T00:00:00Z",
    "window_end": "2026-11-25T00:00:00Z",
    "net_precision": {
      "name": "Day",
      "abbrev": "DAY"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/shenzhou_22_lau_image_20251129175823.jpg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "China Aerospace Science and Technology Corporation",
      "type": "Government"
    },
    "rocket": {
      "configuration": {
        "name": "Long March 2F/G",
        "family": "Long March",
        "full_name": "Long March 2F/G",
        "variant": "F/G"
      }
    },
    "mission": {
      "name": "Shenzhou 24",
      "description": "Shenzhou 24 will be the 24th flight of the Shenzhou program.\r\n\r\nThe first astronaut from Pakistan is expected to fly on this on a short duration mission, with another Chinese astronaut to undergo a year long expedition.",
      "type": "Human Exploration",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Launch Area 91 (SLS-1 / 921)",
      "latitude": "40.957893",
      "longitude": "100.290944",
      "location": {
        "name": "Jiuquan Satellite Launch Center, People's Republic of China",
        "country_code": "CHN"
      }
    }
  },
  {
    "id": "dff42a2e-f047-48d7-b260-3888d3a4fe33",
    "name": "Spectrum | AT-Astra and Others (Spectrum Flight 3)",
    "net": "2026-11-26T20:00:00Z",
    "window_start": "2026-11-26T20:00:00Z",
    "window_end": "2026-11-26T21:30:00Z",
    "net_precision": {
      "name": "Hour",
      "abbrev": "HR"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/spectrum_on_the_image_20250321072643.jpeg",
    "status": {
      "abbrev": "TBC",
      "name": "To Be Confirmed",
      "description": "Awaiting official confirmation - current date is known with some certainty."
    },
    "launch_service_provider": {
      "name": "Isar Aerospace",
      "type": "Private"
    },
    "rocket": {
      "configuration": {
        "name": "Spectrum",
        "family": "",
        "full_name": "Spectrum",
        "variant": ""
      }
    },
    "mission": {
      "name": "AT-Astra and Others (Spectrum Flight 3)",
      "description": "Third test flight of the Isar Spectrum launch vehicle. This launch will carry various satellites including R-Space’s AT-Astra/IOD-01, which will perform in-orbit demonstrations for ENPULSION, SUNBOOSTER GmbH, and Synopsis Planet.",
      "type": "Technology",
      "orbit": {
        "name": "Sun-Synchronous Orbit",
        "abbrev": "SSO"
      }
    },
    "pad": {
      "name": "Orbital Launch Pad",
      "latitude": "69.1084",
      "longitude": "15.5895",
      "location": {
        "name": "Andøya Spaceport",
        "country_code": "NOR"
      }
    }
  },
  {
    "id": "d74afbc7-0de5-491c-be05-4e9c31f736ac",
    "name": "Falcon 9 Block 5 | Cygnus CRS-2 NG-25",
    "net": "2026-11-29T15:47:00Z",
    "window_start": "2026-11-29T15:47:00Z",
    "window_end": "2026-11-29T15:47:00Z",
    "net_precision": {
      "name": "Minute",
      "abbrev": "MIN"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/falcon_9_image_20230807133459.jpeg",
    "status": {
      "abbrev": "Go",
      "name": "Go for Launch",
      "description": "Current T-0 confirmed by official or reliable sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "Cygnus CRS-2 NG-25",
      "description": "This is the 25th flight of the Orbital ATK's uncrewed resupply spacecraft Cygnus and its 24th flight to the International Space Station under the Commercial Resupply Services contract with NASA.",
      "type": "Resupply",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Space Launch Complex 40",
      "latitude": "28.56194122",
      "longitude": "-80.57735736",
      "location": {
        "name": "Cape Canaveral SFS, FL, USA",
        "country_code": "USA"
      }
    }
  },
  {
    "id": "2093e4fc-ac8c-4296-a1b5-deececee6a72",
    "name": "Electron | StriX Launch 14",
    "net": "2026-11-30T00:00:00Z",
    "window_start": "2026-11-30T00:00:00Z",
    "window_end": "2026-11-30T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/electron_image_20190705175640.jpeg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "Rocket Lab",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Electron",
        "family": "",
        "full_name": "Electron",
        "variant": ""
      }
    },
    "mission": {
      "name": "StriX Launch 14",
      "description": "Synthetic aperture radar satellite for Japanese Earth imaging company Synspective.",
      "type": "Earth Science",
      "orbit": {
        "name": "Sun-Synchronous Orbit",
        "abbrev": "SSO"
      }
    },
    "pad": {
      "name": "Unknown Pad",
      "latitude": "-39.260881",
      "longitude": "177.865826",
      "location": {
        "name": "Rocket Lab Launch Complex 1, Mahia Peninsula, New Zealand",
        "country_code": "NZL"
      }
    }
  },
  {
    "id": "56ca6058-7ccc-4ec0-b1b0-fb49f3bfee49",
    "name": "Falcon 9 Block 5 | NROL-195",
    "net": "2026-11-30T00:00:00Z",
    "window_start": "2026-11-30T00:00:00Z",
    "window_end": "2026-11-30T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/falcon_9_on_slc_image_20241024165956.jpg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "NROL-195",
      "description": "Sixteenth batch of satellites for a reconnaissance satellite constellation built by SpaceX and Northrop Grumman for the National Reconnaissance Office to provide imaging and other reconnaissance capabilities.",
      "type": "Government/Top Secret",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Space Launch Complex 4E",
      "latitude": "34.632",
      "longitude": "-120.611",
      "location": {
        "name": "Vandenberg SFB, CA, USA",
        "country_code": "USA"
      }
    }
  },
  {
    "id": "b0dc988c-ea4a-423f-81b6-6b0fbe7cc17c",
    "name": "Falcon 9 Block 5 | OneWeb 21",
    "net": "2026-11-30T00:00:00Z",
    "window_start": "2026-11-30T00:00:00Z",
    "window_end": "2026-11-30T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/falcon_9_liftof_image_20241020164113.jpeg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "OneWeb 21",
      "description": "A batch of 32 satellites for the OneWeb satellite constellation, which is intended to provide global Internet broadband service for individual consumers. The constellation is planned to have around 648 microsatellites (of which 60 are spares), around 150 kg each, operating in Ku-band from low Earth orbit.",
      "type": "Communications",
      "orbit": {
        "name": "Polar Orbit",
        "abbrev": "PO"
      }
    },
    "pad": {
      "name": "Space Launch Complex 4E",
      "latitude": "34.632",
      "longitude": "-120.611",
      "location": {
        "name": "Vandenberg SFB, CA, USA",
        "country_code": "USA"
      }
    }
  },
  {
    "id": "3cdb9dee-b5cb-406c-bbd1-06a219930fb7",
    "name": "Falcon 9 Block 5 | Starlink Group 15-21",
    "net": "2026-11-30T00:00:00Z",
    "window_start": "2026-11-30T00:00:00Z",
    "window_end": "2026-11-30T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/falcon2520925_image_20221009234147.png",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "Starlink Group 15-21",
      "description": "A batch of 27 satellites for the Starlink mega-constellation - SpaceX's project for space-based Internet communication system.",
      "type": "Communications",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Space Launch Complex 4E",
      "latitude": "34.632",
      "longitude": "-120.611",
      "location": {
        "name": "Vandenberg SFB, CA, USA",
        "country_code": "USA"
      }
    }
  },
  {
    "id": "e2523821-9760-4cb4-ad1f-7ce2e30419bd",
    "name": "Kuaizhou 11 | Unknown Payload",
    "net": "2026-11-30T00:00:00Z",
    "window_start": "2026-11-30T00:00:00Z",
    "window_end": "2026-11-30T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/kuaizhou_11_lif_image_20240520155835.jpg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "ExPace",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Kuaizhou 11",
        "family": "Kuaizhou",
        "full_name": "Kuaizhou 11",
        "variant": "11"
      }
    },
    "mission": {
      "name": "Unknown Payload",
      "description": "Details TBD.",
      "type": "Unknown",
      "orbit": {
        "name": "Unknown",
        "abbrev": "N/A"
      }
    },
    "pad": {
      "name": "Launch Area 95A",
      "latitude": "40.969117",
      "longitude": "100.343333",
      "location": {
        "name": "Jiuquan Satellite Launch Center, People's Republic of China",
        "country_code": "CHN"
      }
    }
  },
  {
    "id": "dfac5ab7-7017-454f-b6cf-eeed277a97b5",
    "name": "LVM-3 | Gaganyaan-1",
    "net": "2026-11-30T00:00:00Z",
    "window_start": "2026-11-30T00:00:00Z",
    "window_end": "2026-11-30T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/gslv2520mk2520iii_image_20190604000938.jpg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "Indian Space Research Organization",
      "type": "Government"
    },
    "rocket": {
      "configuration": {
        "name": "LVM-3 (GSLV Mk III)",
        "family": "GSLV",
        "full_name": "Launch Vehicle Mark-3 (GSLV Mk III)",
        "variant": ""
      }
    },
    "mission": {
      "name": "Gaganyaan-1",
      "description": "First uncrewed orbital test flight of the Gaganyaan capsule.",
      "type": "Test Flight",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Satish Dhawan Space Centre Second Launch Pad",
      "latitude": "13.7199",
      "longitude": "80.2304",
      "location": {
        "name": "Satish Dhawan Space Centre, India",
        "country_code": "IND"
      }
    }
  },
  {
    "id": "9e27a1ed-e81a-4918-b32b-0380cf3a9f8f",
    "name": "Mir | Demo Flight",
    "net": "2026-11-30T00:00:00Z",
    "window_start": "2026-11-30T00:00:00Z",
    "window_end": "2026-11-30T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/south2520korea_image_20231204145331.png",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "Agency for Defense Development",
      "type": "Government"
    },
    "rocket": {
      "configuration": {
        "name": "Mir",
        "family": "Mir",
        "full_name": "Mir",
        "variant": ""
      }
    },
    "mission": {
      "name": "Demo Flight",
      "description": "Note: Launch vehicle name is provisional.\r\n\r\nFirst orbital full version launch of the South Korean military small satellite launch vehicle, after 2 sub-orbital tests of individual stages on 30 March and 30 December 2022, and 1 orbital test flight without the 2nd stage on 4 December 2023. Details TBD.",
      "type": "Test Flight",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "ADD Offshore launch platform",
      "latitude": "33.216667",
      "longitude": "126.366667",
      "location": {
        "name": "Sea Launch",
        "country_code": "???"
      }
    }
  },
  {
    "id": "b5a9bccb-30d7-4af6-8ad1-fabb563be53c",
    "name": "PSLV-XL | TDS-01",
    "net": "2026-11-30T00:00:00Z",
    "window_start": "2026-11-30T00:00:00Z",
    "window_end": "2026-11-30T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/pslv_image_20190224012254.jpeg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "Indian Space Research Organization",
      "type": "Government"
    },
    "rocket": {
      "configuration": {
        "name": "PSLV-XL",
        "family": "PSLV",
        "full_name": "PSLV XL",
        "variant": "XL"
      }
    },
    "mission": {
      "name": "TDS-01",
      "description": "TDS-01 (Technology Demonstration Satellite-01) is an Indian geostationary orbit technology demonstration satellite carrying payloads for the Indian Space Research Organisation (ISRO)’s Institute of Plasma Research, Gandhinagar and the CSIR-CEERI, Pilani. \r\n\r\nPayloads to be tested included an internally developed 300 mN electric powered thrusters, atomic clocks, travelling wave tube amplifiers (TWTA) & a quantum communication suite (QuTDS).",
      "type": "Technology",
      "orbit": {
        "name": "Geostationary Transfer Orbit",
        "abbrev": "GTO"
      }
    },
    "pad": {
      "name": "Satish Dhawan Space Centre First Launch Pad",
      "latitude": "13.733",
      "longitude": "80.235",
      "location": {
        "name": "Satish Dhawan Space Centre, India",
        "country_code": "IND"
      }
    }
  },
  {
    "id": "22e117bf-041c-49d5-9d09-7b180036e143",
    "name": "Ariane 62 | Metop-SG B1",
    "net": "2026-12-31T00:00:00Z",
    "window_start": "2026-12-31T00:00:00Z",
    "window_end": "2026-12-31T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/ariane_62_lifto_image_20240711132056.jpeg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "Arianespace",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Ariane 62",
        "family": "Ariane",
        "full_name": "Ariane 62",
        "variant": "62"
      }
    },
    "mission": {
      "name": "Metop-SG B1",
      "description": "Second of EUMETSAT's second generation of Metop weather satellites.",
      "type": "Earth Science",
      "orbit": {
        "name": "Sun-Synchronous Orbit",
        "abbrev": "SSO"
      }
    },
    "pad": {
      "name": "Ariane Launch Area 4",
      "latitude": "5.256319",
      "longitude": "-52.786838",
      "location": {
        "name": "Guiana Space Centre, French Guiana",
        "country_code": "GUF"
      }
    }
  },
  {
    "id": "8bf5f61e-a7e1-41e6-aede-7b87e4beebab",
    "name": "Falcon 9 Block 5 | CHORUS",
    "net": "2026-12-31T00:00:00Z",
    "window_start": "2026-12-31T00:00:00Z",
    "window_end": "2026-12-31T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/falcon_9_image_20230807133459.jpeg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "CHORUS",
      "description": "CHORUS is MDA's next generation Earth observation constellation, consisting of 2 radar satellites (C-band SAR and X-band SAR), in a 53.5 degree 600 km altitude LEO, with the X-band trailing the C-band by 60 minutes. A collaborative multi-sensor constellation, CHORUS will bring together diverse and unique imagery and data sources and provide a new level of near real-time insight and innovative Earth observation services. Operating in a unique mid-inclination orbit, CHORUS will be able to image day or night, regardless of weather conditions, with daily access of up to 95% of the coverage area. From an industry-leading 700km-wide imaging swath down to sub-metre high resolution, CHORUS will provide the most extensive and unrivalled Earth observation radar imaging capacity available on the market in a single mission.",
      "type": "Earth Science",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Unknown Pad",
      "latitude": "28.458",
      "longitude": "-80.528",
      "location": {
        "name": "Cape Canaveral SFS, FL, USA",
        "country_code": "USA"
      }
    }
  },
  {
    "id": "e61d353c-db55-4a57-8184-0fab187231e6",
    "name": "Falcon 9 Block 5 | Globalstar 2-R Mission 2 (x 9)",
    "net": "2026-12-31T00:00:00Z",
    "window_start": "2026-12-31T00:00:00Z",
    "window_end": "2026-12-31T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/falcon_9_image_20230807133459.jpeg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "Globalstar 2-R Mission 2 (x 9)",
      "description": "The Globalstar global mobile communications network offers global, digital real time voice, data and fax services via its Low Earth Orbit satellite constellation. The constellation operates in a 1410 km orbit inclined at 52 degrees.\r\n\r\nIn early 2022, Globalstar contracted with MDA for the construction of 17 new 2nd generation refresh satellites to replenish the existing constellation. Rocket Lab is sub-contracted to build the satellites' buses and the launch dispensers.",
      "type": "Communications",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Space Launch Complex 40",
      "latitude": "28.56194122",
      "longitude": "-80.57735736",
      "location": {
        "name": "Cape Canaveral SFS, FL, USA",
        "country_code": "USA"
      }
    }
  },
  {
    "id": "71df1dd0-d658-4762-b0bc-0fca6886aea7",
    "name": "Falcon 9 Block 5 | SDA Tranche 2 Transport Layer D",
    "net": "2026-12-31T00:00:00Z",
    "window_start": "2026-12-31T00:00:00Z",
    "window_end": "2026-12-31T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/falcon_9_image_20230807133459.jpeg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "SDA Tranche 2 Transport Layer D",
      "description": "Classified mission launched by the Space Development Agency (SDA) for Tranche 2 Transport Layer.",
      "type": "Government/Top Secret",
      "orbit": {
        "name": "Polar Orbit",
        "abbrev": "PO"
      }
    },
    "pad": {
      "name": "Unknown Pad",
      "latitude": "28.458",
      "longitude": "-80.528",
      "location": {
        "name": "Cape Canaveral SFS, FL, USA",
        "country_code": "USA"
      }
    }
  },
  {
    "id": "71ed4649-8d71-42e8-8548-d42ffa2c5a6e",
    "name": "Falcon 9 Block 5 | SDA Tranche 2 Transport Layer E",
    "net": "2026-12-31T00:00:00Z",
    "window_start": "2026-12-31T00:00:00Z",
    "window_end": "2026-12-31T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/falcon_9_image_20230807133459.jpeg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "SDA Tranche 2 Transport Layer E",
      "description": "Classified mission launched by the Space Development Agency (SDA) for Tranche 2 Transport Layer.",
      "type": "Government/Top Secret",
      "orbit": {
        "name": "Polar Orbit",
        "abbrev": "PO"
      }
    },
    "pad": {
      "name": "Space Launch Complex 4E",
      "latitude": "34.632",
      "longitude": "-120.611",
      "location": {
        "name": "Vandenberg SFB, CA, USA",
        "country_code": "USA"
      }
    }
  },
  {
    "id": "0cf92611-82a8-4095-a0b4-dda2e74b1fff",
    "name": "LVM-3 | GSAT-32 (GSAT-N3)",
    "net": "2026-12-31T00:00:00Z",
    "window_start": "2026-12-31T00:00:00Z",
    "window_end": "2026-12-31T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/gslv2520mk2520iii_image_20190604000938.jpg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "Indian Space Research Organization",
      "type": "Government"
    },
    "rocket": {
      "configuration": {
        "name": "LVM-3 (GSLV Mk III)",
        "family": "GSLV",
        "full_name": "Launch Vehicle Mark-3 (GSLV Mk III)",
        "variant": ""
      }
    },
    "mission": {
      "name": "GSAT-32 (GSAT-N3)",
      "description": "GSAT-32 is a geostationary communications satellite for the Indian Space Research Organization (ISRO). The spacecraft is a replacement for GSAT-6A that failed before reaching geostationary orbit after launch in 2018.",
      "type": "Communications",
      "orbit": {
        "name": "Geostationary Transfer Orbit",
        "abbrev": "GTO"
      }
    },
    "pad": {
      "name": "Satish Dhawan Space Centre Second Launch Pad",
      "latitude": "13.7199",
      "longitude": "80.2304",
      "location": {
        "name": "Satish Dhawan Space Centre, India",
        "country_code": "IND"
      }
    }
  },
  {
    "id": "912a8aee-8fc2-47b4-81a5-040fa0e0a36f",
    "name": "Vega-C | IRIDE 1",
    "net": "2026-12-31T00:00:00Z",
    "window_start": "2026-12-31T00:00:00Z",
    "window_end": "2026-12-31T00:00:00Z",
    "net_precision": {
      "name": "Month",
      "abbrev": "M"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/vega-c_image_20220713154437.jpg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "Avio S.p.A",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Vega-C",
        "family": "Vega",
        "full_name": "Vega-C",
        "variant": ""
      }
    },
    "mission": {
      "name": "IRIDE 1",
      "description": "First dedicated launch for the European Space Agency's IRIDE Earth observation constellation, with six satellites onboard.",
      "type": "Earth Science",
      "orbit": {
        "name": "Sun-Synchronous Orbit",
        "abbrev": "SSO"
      }
    },
    "pad": {
      "name": "Ariane Launch Area 1 (ELV)",
      "latitude": "5.236",
      "longitude": "-52.775",
      "location": {
        "name": "Guiana Space Centre, French Guiana",
        "country_code": "GUF"
      }
    }
  },
  {
    "id": "548df42c-ae26-4cc9-921a-f0042941911a",
    "name": "Electron | BlackSky Gen-3 6",
    "net": "2026-12-31T00:00:00Z",
    "window_start": "2026-12-31T00:00:00Z",
    "window_end": "2026-12-31T00:00:00Z",
    "net_precision": {
      "name": "Quarter 4",
      "abbrev": "Q4"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/electron_image_20190705175640.jpeg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "Rocket Lab",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Electron",
        "family": "",
        "full_name": "Electron",
        "variant": ""
      }
    },
    "mission": {
      "name": "BlackSky Gen-3 6",
      "description": "BlackSky Gen-3 Earth-imaging satellites",
      "type": "Earth Science",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Unknown Pad",
      "latitude": "-39.260881",
      "longitude": "177.865826",
      "location": {
        "name": "Rocket Lab Launch Complex 1, Mahia Peninsula, New Zealand",
        "country_code": "NZL"
      }
    }
  },
  {
    "id": "5aa3575e-f3ff-48ec-969f-e7e4c669f866",
    "name": "Electron | BlackSky Gen-3 7",
    "net": "2026-12-31T00:00:00Z",
    "window_start": "2026-12-31T00:00:00Z",
    "window_end": "2026-12-31T00:00:00Z",
    "net_precision": {
      "name": "Quarter 4",
      "abbrev": "Q4"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/electron_image_20190705175640.jpeg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "Rocket Lab",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Electron",
        "family": "",
        "full_name": "Electron",
        "variant": ""
      }
    },
    "mission": {
      "name": "BlackSky Gen-3 7",
      "description": "BlackSky Gen-3 Earth-imaging satellites",
      "type": "Earth Science",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Unknown Pad",
      "latitude": "-39.260881",
      "longitude": "177.865826",
      "location": {
        "name": "Rocket Lab Launch Complex 1, Mahia Peninsula, New Zealand",
        "country_code": "NZL"
      }
    }
  },
  {
    "id": "11b218b1-5e40-4b9d-854e-50320299239d",
    "name": "Falcon 9 Block 5 | BlueBird 14-16 (Block 2 #9-11)",
    "net": "2026-12-31T00:00:00Z",
    "window_start": "2026-12-31T00:00:00Z",
    "window_end": "2026-12-31T00:00:00Z",
    "net_precision": {
      "name": "Quarter 4",
      "abbrev": "Q4"
    },
    "probability": null,
    "holdreason": "",
    "failreason": "",
    "webcast_live": false,
    "image": "https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/f9_on_slc-40_2_image_20240919072420.jpg",
    "status": {
      "abbrev": "TBD",
      "name": "To Be Determined",
      "description": "Current date is a placeholder or rough estimation based on unreliable or interpreted sources."
    },
    "launch_service_provider": {
      "name": "SpaceX",
      "type": "Commercial"
    },
    "rocket": {
      "configuration": {
        "name": "Falcon 9",
        "family": "Falcon",
        "full_name": "Falcon 9 Block 5",
        "variant": "Block 5"
      }
    },
    "mission": {
      "name": "BlueBird 14-16 (Block 2 #9-11)",
      "description": "AST SpaceMobile’s Block 2 BlueBird satellites are designed to deliver up to 10 times the bandwidth capacity of the BlueBird Block 1 satellites, required to achieve 24/7 continuous cellular broadband service coverage in the United States, with beams designed to support a capacity of up to 40 MHz, enabling peak data transmission speeds up to 120 Mbps, supporting voice, full data and video applications. The Block 2 BlueBirds, featuring as large as 2400 square foot communications arrays, will be the largest satellites ever commercially deployed in Low Earth orbit once launched.\r\n\r\nThis launch will feature 3 satellites.",
      "type": "Communications",
      "orbit": {
        "name": "Low Earth Orbit",
        "abbrev": "LEO"
      }
    },
    "pad": {
      "name": "Space Launch Complex 40",
      "latitude": "28.56194122",
      "longitude": "-80.57735736",
      "location": {
        "name": "Cape Canaveral SFS, FL, USA",
        "country_code": "USA"
      }
    }
  }
]
