import { captureCameraPhoto, listCameraDevices, runCameraDoctor } from '../tools/desktop.tool.js';
import { printPanel, printTable } from './format.js';

export async function runCameraDoctorCli() {
  const checks = await runCameraDoctor();
  printTable(
    ['Check', 'Status', 'Detail'],
    checks.map((check) => [check.name, check.status, check.detail]),
  );
}

export async function listCameraDevicesCli() {
  const devices = await listCameraDevices();
  if (devices.length === 0) {
    printPanel('Camera Devices', [
      ['Status', 'No camera devices were detected'],
      ['Next', 'Run zilmate camera doctor'],
      ['Manual device', 'Set ZILMATE_CAMERA_DEVICE or pass --device'],
    ]);
    return;
  }

  printTable(
    ['Name', 'Input'],
    devices.map((device) => [device.name, device.input]),
  );
}

export async function captureCameraCli(options: { device?: string }) {
  const file = await captureCameraPhoto(options.device);
  printPanel('Camera Capture', [
    ['Status', 'succeeded'],
    ['File', file],
    ['Analyze', 'Ask ZilMate in talk: analyze this camera photo'],
  ]);
}
