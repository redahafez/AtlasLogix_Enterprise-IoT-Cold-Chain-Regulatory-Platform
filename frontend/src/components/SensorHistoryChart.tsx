'use client';

import React from 'react';
import { SensorReading, Shipment } from '@/lib/types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface SensorHistoryChartProps {
  shipment: Shipment;
  readings: SensorReading[];
}

export function SensorHistoryChart({ shipment, readings }: SensorHistoryChartProps) {
  if (!readings || readings.length === 0) {
    return (
      <div className="p-8 text-center bg-[var(--color-bg-subtle)] rounded-xl border border-[var(--color-border-default)]">
        <p className="text-sm text-[var(--color-text-secondary)]">No telemetry sensor history recorded for this shipment yet.</p>
      </div>
    );
  }

  const labels = readings.map(r => {
    const d = new Date(r.recordedAt);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  const tempValues = readings.map(r => r.temperature);
  const humValues = readings.map(r => r.humidity);

  const minTempThreshold = readings.map(() => shipment.requiredTemperatureMin);
  const maxTempThreshold = readings.map(() => shipment.requiredTemperatureMax);

  const data = {
    labels,
    datasets: [
      {
        label: 'Temperature (°C)',
        data: tempValues,
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.3,
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'yTemp',
      },
      {
        label: 'Humidity (%)',
        data: humValues,
        borderColor: '#14B8A6',
        backgroundColor: 'rgba(20, 184, 166, 0.1)',
        tension: 0.3,
        borderWidth: 2,
        borderDash: [3, 3],
        pointRadius: 3,
        yAxisID: 'yHum',
      },
      {
        label: `Required Max Temp (${shipment.requiredTemperatureMax}°C)`,
        data: maxTempThreshold,
        borderColor: '#C2414C',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        yAxisID: 'yTemp',
      },
      {
        label: `Required Min Temp (${shipment.requiredTemperatureMin}°C)`,
        data: minTempThreshold,
        borderColor: '#D97706',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        yAxisID: 'yTemp',
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: { family: 'Inter', size: 11 },
          usePointStyle: true,
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      }
    },
    scales: {
      yTemp: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Temperature (°C)',
          font: { family: 'Inter', size: 11, weight: 'bold' as const }
        },
        grid: {
          color: 'rgba(226, 232, 240, 0.6)'
        }
      },
      yHum: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Humidity (%)',
          font: { family: 'Inter', size: 11, weight: 'bold' as const }
        },
        grid: {
          drawOnChartArea: false,
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Chart Visual Canvas */}
      <div className="h-72 w-full p-4 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-default)] shadow-sm">
        <Line data={data} options={options} />
      </div>

      {/* Accessible Data Table (for screen readers and low-vision fallback) */}
      <div className="overflow-x-auto">
        <h4 className="sr-only">Sensor Readings Chronological Data Table</h4>
        <table className="w-full text-xs text-left border-collapse border border-[var(--color-border-default)]">
          <caption className="sr-only">Detailed chronological sensor telemetry data</caption>
          <thead className="bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] font-semibold">
            <tr>
              <th className="p-2 border">Timestamp</th>
              <th className="p-2 border">Temperature (°C)</th>
              <th className="p-2 border">Humidity (%)</th>
              <th className="p-2 border">Vibration (g)</th>
              <th className="p-2 border">Battery (%)</th>
              <th className="p-2 border">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => {
              const isTempExcursion = r.temperature < shipment.requiredTemperatureMin || r.temperature > shipment.requiredTemperatureMax;
              const isHumExcursion = r.humidity < shipment.requiredHumidityMin || r.humidity > shipment.requiredHumidityMax;

              return (
                <tr key={r.eventId} className="hover:bg-[var(--color-bg-subtle)] transition-colors border-b">
                  <td className="p-2 font-mono">{new Date(r.recordedAt).toLocaleString()}</td>
                  <td className={`p-2 font-semibold ${isTempExcursion ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>
                    {r.temperature}°C {isTempExcursion && '⚠️ Excursion'}
                  </td>
                  <td className={`p-2 ${isHumExcursion ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}`}>
                    {r.humidity}% {isHumExcursion && '⚠️ Excursion'}
                  </td>
                  <td className="p-2">{r.vibration !== null && r.vibration !== undefined ? `${r.vibration}g` : '—'}</td>
                  <td className="p-2">{r.batteryLevel !== null && r.batteryLevel !== undefined ? `${r.batteryLevel}%` : '—'}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.confidence === 'HIGH' ? 'bg-emerald-100 text-emerald-800' :
                      r.confidence === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {r.confidence}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
