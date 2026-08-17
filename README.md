# Zero-Footprint DICOM Image Viewer

A modern, high-performance, web-based DICOM medical image viewer built with **Next.js (App Router)**, **TypeScript**, **Cornerstone.js**, and **Tailwind CSS**.

It follows a strict **zero-footprint** architecture: all DICOM parsing, image decoding, rendering, and reporting occur locally inside the browser. No patient data or DICOM binaries are ever uploaded to a remote server.

---

## 🌟 Key Features

### 🔒 Zero-Footprint & Privacy First
- **100% Client-Side Processing**: Files and directories are parsed entirely in the user's browser via dedicated Web Workers.
- **Data Privacy**: No medical data, patient records, or images leave the local device.

### 🖼️ Multi-Viewport & Layout Management
- Flexible viewports: **1x1**, **1x2**, and **2x2** grid configurations.
- Independent series loading, scrolling, panning, zooming, and windowing per viewport.
- Series thumbnail list with quick study/series navigation and instant viewport assignment.

### 📐 Diagnostic & Measurement Tools
- **Window Level / Window Center (WW/WC)**: Interactive drag adjustments.
- **Pan & Zoom**: Smooth translation and magnification.
- **Length Measurement**: Calibrated distance in millimeters using DICOM Pixel Spacing.
- **Angle Tool**: 3-point angle measurement in degrees.
- **ROI (Region of Interest)**: Area calculation (cm² / mm²), Mean Hounsfield Units (HU), Standard Deviation, Min, and Max values.
- **Pixel Probe & 3D Cursor**: Spatial cross-referencing that calculates 3D patient coordinates ($x, y, z$) and automatically synchronizes perpendicular/orthogonal slice viewports to the exact anatomical intersection point.
- **Measurement Management**: Overlay toggle, individual selection/deletion, and clear-all capabilities.

### 📝 Structured Reporting
- Integrated **Reporting Panel** for writing diagnostic findings.
- **One-Click Save & Export**: Downloads a formatted `.txt` report file containing:
  - Report date and save timestamp
  - Detailed study metadata (Patient Name, Patient ID, Study Date/Time, Description, Institution, etc.)
  - Structured findings text
- **Clipboard Support**: Direct one-click copy of the formatted report text.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 15+ (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Medical Imaging**:
  - `cornerstone-core`
  - `cornerstone-wado-image-loader`
  - `dicom-parser`
- **Concurrency**: Web Workers (`dicom.worker.ts`) for non-blocking asynchronous file parsing
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)

---

## 📁 Project Structure

```text
├── app/
│   ├── layout.tsx             # Root application layout
│   ├── page.tsx               # Primary DICOM viewer & viewport orchestration
│   ├── globals.css            # Tailwind styling setup
│   └── workers/
│       └── dicom.worker.ts    # Dedicated Web Worker for off-thread DICOM parsing
├── components/
│   ├── Icons.tsx              # Custom medical and measurement SVG icons
│   └── ...
├── utils/
│   ├── dicomGeometry.ts       # 3D spatial transforms, slice intersection & patient orientation
│   ├── formatters.ts          # DICOM dates, times, and string formatters
│   ├── reportGenerator.ts     # Structured report generation and file download utilities
│   └── types.ts               # Core TypeScript definitions (DICOM metadata, instances, tools)
├── public/                    # Static assets
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ installed
- npm, yarn, or pnpm

### Installation

```bash
git clone https://github.com/jaaniin/DICOM-Image-Viewer.git
cd DICOM-Image-Viewer
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

### Building for Production

```bash
npm run build
npm run start
```

---

## 📖 How to Use

1. **Load Data**: Drag & drop a DICOM file or an entire folder of DICOM slices into the viewer window (or click to select files).
2. **Navigate Series**: The left sidebar organizes files into **Studies** and **Series**. Drag or select a series into any active viewport.
3. **Select Tools**: Use the top toolbar to switch between **WW/WC**, **Pan**, **Zoom**, **Length**, **Angle**, **ROI**, or **Pixel Probe**.
4. **Synchronize Views**: Select **Pixel Probe** and click on an anatomical feature in any viewport to auto-align other orthogonal views to that exact 3D point.
5. **Create Report**: Click the **Reporting** tab on the sidebar, type your clinical notes, and click **Save Report** or **Copy Full Report Text**.

---

## ⚠️ Medical Disclaimer

This software is developed for **educational, research, and demonstration purposes only**. It is **not** a certified medical device and must **not** be used for clinical diagnosis, patient care, or medical decision-making.

---

## 📄 License

MIT License. See `LICENSE` for details.