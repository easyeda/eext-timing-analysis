# Timing Analysis Tool

A professional PCB timing diagram analysis extension for JLCEDA Professional Edition (EasyEDA Pro).

## Features

### Main Interface
![Main Interface](images/timing-main.png)

### Net Highlighting
![Highlighting](images/timing-highlight.png)

### Theme Toggle
![Theme Toggle](images/timing-theme-toggle.png)

This extension analyzes timing relationships between two components in your PCB design. By selecting source and destination components, it automatically analyzes the signal nets between them, calculates path delay and timing margin in real-time, and generates intuitive timing diagrams.

### 1. Component Selection Analysis
- Select source and destination components
- Automatically identify common nets between components
- Display component info and net list

### 2. Timing Parameters
- Clock frequency setting (1-1000 MHz)
- Setup Time (Tsu) configuration
- Hold Time (Th) configuration
- Real-time timing margin calculation

### 3. Timing Diagram Visualization
- Generate intuitive SVG timing diagrams
- Display clock, data output, data input signals
- Mark Launch/Capture timing points
- Show Setup/Hold time windows
- Show Tpd propagation delay
- Show PASS/FAIL status

### 4. Net Highlighting
- Auto-highlight selected nets during analysis
- Mouse hover temporary highlighting
- Auto-unhighlight on close

### 5. Export
- Support SVG/PNG/JPG export
- PNG/JPG at 3x resolution

### 6. Interface Themes
- Dark theme
- Light theme
- Follow system theme

### 7. Interactive Features
- Mouse wheel horizontal zoom
- Mouse drag pan view
- Ctrl+wheel vertical scroll
- Search filter nets

## Installation

1. Open JLCEDA Professional Edition
2. Go to Extensions → Extension Manager
3. Import the `.eext` file

## Usage

### Step 1: Analyze
1. Open a PCB document
2. Click menu: **Timing Analysis** → **Select Components to Analyze**
3. Select two components on the PCB (source → destination)

### Step 2: Configure
In the settings dialog:
- Set clock frequency
- Set Setup Time and Hold Time
- Check nets to analyze (supports search filter)

### Step 3: View Results
- Click "Calculate" to see timing results
- View timing diagram and margin

### Cancel Selection
Click **Timing Analysis** → **Cancel Selection**

## Timing Parameters

| Parameter | Description |
|-----------|-------------|
| Clock Frequency | Clock signal frequency (MHz) |
| Period | Clock period (ns) = 1000/frequency |
| Setup Time (Tsu) | Time signal must be stable before clock edge |
| Hold Time (Th) | Time signal must be stable after clock edge |
| Tpd | Propagation delay from source to destination |
| Margin | Tpd - Tsu - Th, positive = PASS |

## Requirements

- JLCEDA Professional Edition v3.0.0+
- No other extension dependencies

## License

Apache-2.0
