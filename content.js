// OpenAI Logs Exporter Content Script

// Use a persistent global variable that won't reset if script re-runs
if (!window.__logsExporterData) {
  window.__logsExporterData = {
    collectedLogs: new Map(),
    initialized: false
  };
  console.log('[Logs Exporter] Initialized storage');
}

const collectedLogs = window.__logsExporterData.collectedLogs;

// Continuously collect logs from DOM as they appear
function collectVisibleLogs() {
  const logLinks = Array.from(document.querySelectorAll('a[href^="/logs/resp_"]'));

  let newLogsCount = 0;

  logLinks.forEach(link => {
    const requestId = link.getAttribute('href')?.split('/logs/')[1] || '';

    // Skip if we already have this log
    if (collectedLogs.has(requestId)) {
      return;
    }

    // Each link has 4 div children - input, output, model, created
    const columns = Array.from(link.querySelectorAll(':scope > div'));

    const logData = {
      requestId,
      input: columns[0]?.textContent?.trim() || '',
      output: columns[1]?.textContent?.trim() || '',
      model: columns[2]?.textContent?.trim() || '',
      created: columns[3]?.textContent?.trim() || '',
      position: link.getBoundingClientRect().top + window.pageYOffset
    };

    collectedLogs.set(requestId, logData);
    newLogsCount++;
  });

  if (newLogsCount > 0) {
    console.log(`[Logs Exporter] Collected ${newLogsCount} new logs. Total: ${collectedLogs.size}`);
    updateExportButton();
  }
}

function escapeCSV(text) {
  // Always quote all fields and escape special characters
  if (!text) return '""';

  // Escape double quotes by doubling them
  let escaped = text.replace(/"/g, '""');

  // Replace actual newlines with space to prevent row breaks
  escaped = escaped.replace(/\n/g, ' ');
  escaped = escaped.replace(/\r/g, '');

  // Always wrap in quotes
  return `"${escaped}"`;
}

function convertToCSV(logs) {
  if (logs.length === 0) return '';

  // CSV Header
  const headers = ['Request ID', 'Input', 'Output', 'Model', 'Created'];
  const csvRows = [headers.join(',')];

  // CSV Data
  logs.forEach(log => {
    const row = [
      escapeCSV(log.requestId),
      escapeCSV(log.input),
      escapeCSV(log.output),
      escapeCSV(log.model),
      escapeCSV(log.created)
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

function downloadCSV(csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);

  // Generate filename with current date
  const date = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `openai-logs-${date}.csv`);

  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function updateExportButton() {
  const button = document.getElementById('openai-logs-export-btn');
  if (button) {
    const currentCount = collectedLogs.size;
    const previousCount = window.__logsExporterData.lastCount || 0;

    button.textContent = `Export to CSV (${currentCount} logs)`;

    // Log if count decreased (shouldn't happen!)
    if (currentCount < previousCount) {
      console.warn(`[Logs Exporter] WARNING: Count decreased from ${previousCount} to ${currentCount}!`);
    }

    window.__logsExporterData.lastCount = currentCount;
  }
}

function exportLogs() {
  console.log('[Logs Exporter] Exporting collected logs...');

  if (collectedLogs.size === 0) {
    alert('No logs have been collected yet. Please wait for logs to load on the page.');
    return;
  }

  // Convert Map to array and sort by position (top to bottom)
  const allLogs = Array.from(collectedLogs.values()).sort((a, b) => a.position - b.position);
  console.log(`[Logs Exporter] Exporting ${allLogs.length} logs`);

  const csv = convertToCSV(allLogs);
  downloadCSV(csv);

  alert(`Successfully exported ${allLogs.length} log entries to CSV!`);
}

// Create and inject the export button
function createExportButton() {
  // Check if button already exists
  if (document.getElementById('openai-logs-export-btn')) {
    return;
  }

  // Create button
  const button = document.createElement('button');
  button.id = 'openai-logs-export-btn';
  button.textContent = collectedLogs.size > 0 ? `Export to CSV (${collectedLogs.size} logs)` : 'Export to CSV';
  button.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    background-color: #10a37f;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    transition: background-color 0.2s;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = '#0d8a6a';
  });

  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = '#10a37f';
  });

  button.addEventListener('click', exportLogs);

  document.body.appendChild(button);
  console.log('[Logs Exporter] Button added. Starting automatic collection...');
}

// Initialize: create button and start collecting
function initialize() {
  // Prevent double initialization
  if (window.__logsExporterData.initialized) {
    console.log('[Logs Exporter] Already initialized, skipping');
    return;
  }

  createExportButton();

  // Initial collection
  collectVisibleLogs();

  // Set up interval to continuously collect logs as they appear
  const intervalId = setInterval(collectVisibleLogs, 1000);
  window.__logsExporterData.intervalId = intervalId;
  window.__logsExporterData.initialized = true;

  console.log('[Logs Exporter] Extension loaded. Logs will be collected automatically as you browse.');
}

// Wait for page to load and then initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
