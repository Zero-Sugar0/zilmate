# Windows Hotkey Listener & Clipboard Bridge for ZilMate Ubiquity
# Uses Win32 RegisterHotKey API via an in-memory C# WinForms Message Loop

param(
    [int]$Port = 8124,
    [string]$Token = ""
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Web
Add-Type -AssemblyName System.Web.Extensions

$code = @"
using System;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

public class HotkeyHandler : Form {
    [DllImport("user32.dll")]
    public static extern bool RegisterHotKey(IntPtr hWnd, int id, int fsModifiers, int vk);

    [DllImport("user32.dll")]
    public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    private static readonly HttpClient client = new HttpClient();
    private bool processing = false;

    private static void Log(string message) {
        try {
            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string logPath = System.IO.Path.Combine(userProfile, ".zilmate-listener.log");
            string formatted = string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}", DateTime.Now, message);
            System.IO.File.AppendAllText(logPath, formatted + Environment.NewLine);
        } catch {
            // Ignore logging failures
        }
    }

    protected override void OnHandleCreated(EventArgs e) {
        base.OnHandleCreated(e);
        // Register Ctrl+Shift+Z (Modifiers: Ctrl=2, Shift=4 -> 6, Key: 90 is Z)
        bool ok = RegisterHotKey(this.Handle, 1, 6, 90);
        if (!ok) {
            Log("[ZilMate] Failed to register global hotkey Ctrl+Shift+Z!");
        } else {
            Log("[ZilMate] Global hotkey Ctrl+Shift+Z registered successfully.");
        }
    }

    protected override void WndProc(ref Message m) {
        if (m.Msg == 0x0312) { // WM_HOTKEY
            if (m.WParam.ToInt32() == 1) {
                if (!processing) {
                    processing = true;
                    HandleTrigger();
                }
            }
        }
        base.WndProc(ref m);
    }

    private async Task WaitForModifiersReleased() {
        while (true) {
            bool shiftDown = (GetAsyncKeyState(0x10) & 0x8000) != 0;
            bool ctrlDown = (GetAsyncKeyState(0x11) & 0x8000) != 0;
            bool altDown = (GetAsyncKeyState(0x12) & 0x8000) != 0;
            bool winDown = ((GetAsyncKeyState(0x5B) & 0x8000) != 0) || ((GetAsyncKeyState(0x5C) & 0x8000) != 0);
            bool zDown = (GetAsyncKeyState(90) & 0x8000) != 0;

            if (!shiftDown && !ctrlDown && !altDown && !winDown && !zDown) {
                break;
            }
            await Task.Delay(20);
        }
    }

    private bool SafeSetClipboardText(string text) {
        for (int i = 0; i < 5; i++) {
            try {
                Clipboard.SetText(text);
                return true;
            } catch (ExternalException) {
                System.Threading.Thread.Sleep(50);
            }
        }
        return false;
    }

    private string SafeGetClipboardText() {
        for (int i = 0; i < 5; i++) {
            try {
                if (Clipboard.ContainsText()) {
                    return Clipboard.GetText();
                }
                return "";
            } catch (ExternalException) {
                System.Threading.Thread.Sleep(50);
            }
        }
        return "";
    }

    private void SafeClearClipboard() {
        for (int i = 0; i < 5; i++) {
            try {
                Clipboard.Clear();
                return;
            } catch (ExternalException) {
                System.Threading.Thread.Sleep(50);
            }
        }
    }

    private async void HandleTrigger() {
        try {
            Log("[ZilMate] Hotkey triggered! Waiting for modifier release...");
            // 1. Wait for user to physically release keys (prevent modifier key collisions & sticky state)
            await WaitForModifiersReleased();
            Log("[ZilMate] Modifiers released. Capturing text from active application...");

            string originalClipboard = SafeGetClipboardText();
            SafeClearClipboard();

            // 2. Simulate Copy (Ctrl + C) using native events
            keybd_event(0x11, 0, 0, 0); // Ctrl Down
            keybd_event(0x43, 0, 0, 0); // C Down
            keybd_event(0x43, 0, 2, 0); // C Up
            keybd_event(0x11, 0, 2, 0); // Ctrl Up

            // 3. Poll clipboard for copied text with up to 500ms timeout
            string highlightedText = "";
            for (int i = 0; i < 25; i++) {
                highlightedText = SafeGetClipboardText();
                if (!string.IsNullOrEmpty(highlightedText)) {
                    break;
                }
                await Task.Delay(20);
            }

            if (string.IsNullOrWhiteSpace(highlightedText)) {
                Log("[ZilMate] Aborted: No text highlighted or clipboard copy failed.");
                // Restore original clip and abort
                if (!string.IsNullOrEmpty(originalClipboard)) {
                    SafeSetClipboardText(originalClipboard);
                }
                processing = false;
                return;
            }

            Log("[ZilMate] Selection captured (" + highlightedText.Length + " chars). Querying local daemon...");

            // 4. Send POST request to ZilMate Daemon with secure local authorization token
            string escapedText = highlightedText.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
            var content = new StringContent("{\"text\":\"" + escapedText + "\"}", Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, "http://127.0.0.1:$Port/process");
            request.Content = content;
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "$Token");

            var response = await client.SendAsync(request);
            if (response.IsSuccessStatusCode) {
                var responseString = await response.Content.ReadAsStringAsync();
                
                // Robust JSON Parsing via System.Web.Script.Serialization
                try {
                    var serializer = new System.Web.Script.Serialization.JavaScriptSerializer();
                    var dict = serializer.Deserialize<System.Collections.Generic.Dictionary<string, string>>(responseString);
                    if (dict != null && dict.ContainsKey("result")) {
                        string resText = dict["result"];
                        Log("[ZilMate] Response received. Injecting in-place...");
                        
                        // 5. Put response on clipboard & Paste (Ctrl + V)
                        SafeSetClipboardText(resText);
                        
                        keybd_event(0x11, 0, 0, 0); // Ctrl Down
                        keybd_event(0x56, 0, 0, 0); // V Down
                        keybd_event(0x56, 0, 2, 0); // V Up
                        keybd_event(0x11, 0, 2, 0); // Ctrl Up
                        
                        await Task.Delay(200); // wait for paste to finish
                        Log("[ZilMate] Injection completed successfully.");
                    }
                } catch (Exception parseEx) {
                    Log("[ZilMate] JSON Parse Error: " + parseEx.Message);
                }
            } else {
                Log("[ZilMate] Daemon error: HTTP " + response.StatusCode);
            }

            // 6. Restore original clipboard
            if (!string.IsNullOrEmpty(originalClipboard)) {
                SafeSetClipboardText(originalClipboard);
            } else {
                SafeClearClipboard();
            }

        } catch (Exception ex) {
            Log("[ZilMate] Exception: " + ex.Message);
        } finally {
            processing = false;
        }
    }

    protected override void OnFormClosing(FormClosingEventArgs e) {
        UnregisterHotKey(this.Handle, 1);
        base.OnFormClosing(e);
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms, System.Net.Http, System.Web, System.Web.Extensions
$form = New-Object HotkeyHandler
[System.Windows.Forms.Application]::Run($form)
