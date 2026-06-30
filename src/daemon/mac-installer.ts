import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { theme } from '../cli/theme.js';

export function installMacDaemon() {
  if (process.platform !== 'darwin') {
    console.error(theme.error('macOS installation is only supported on macOS hosts.'));
    return;
  }

  const plistLabel = 'com.zilmate.daemon';
  const launchAgentsDir = join(homedir(), 'Library', 'LaunchAgents');
  const plistPath = join(launchAgentsDir, `${plistLabel}.plist`);

  // Resolve absolute paths dynamically
  const nodePath = process.execPath;
  const entryPath = join(process.cwd(), 'dist', 'index.js');

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${plistLabel}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${entryPath}</string>
        <string>daemon</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/zilmate-daemon.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/zilmate-daemon.err</string>
</dict>
</plist>`;

  try {
    mkdirSync(launchAgentsDir, { recursive: true });
    writeFileSync(plistPath, plistContent, 'utf8');

    // Unload if already loaded to avoid duplicate errors
    try {
      execSync(`launchctl unload ${plistPath}`, { stdio: 'ignore' });
    } catch {
      // Ignore failures on unload
    }

    // Load LaunchAgent
    execSync(`launchctl load ${plistPath}`);
    console.log(theme.ok('Successfully registered ZilMate Daemon as a macOS LaunchAgent.'));
    console.log(theme.muted(`Daemon will now automatically start on login. Plist saved to: ${plistPath}`));

    // Install the native Quick Action Service and automatic keyboard shortcut
    installMacQuickAction();
  } catch (error) {
    console.error(theme.error('Failed to install macOS LaunchAgent:'), error);
  }
}

export function installMacQuickAction() {
  const servicesDir = join(homedir(), 'Library', 'Services');
  const workflowName = 'ZilMate Ubiquity.workflow';
  const workflowDir = join(servicesDir, workflowName);
  const contentsDir = join(workflowDir, 'Contents');

  console.log(theme.muted(`\n[Ubiquity] Creating automated macOS Quick Action at ${workflowDir}...`));

  try {
    mkdirSync(contentsDir, { recursive: true });

    // 1. Write Contents/Info.plist
    const infoPlistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSServices</key>
	<array>
		<dict>
			<key>NSBackgroundColorName</key>
			<string>background</string>
			<key>NSMenuItem</key>
			<dict>
				<key>default</key>
				<string>ZilMate Ubiquity</string>
			</dict>
			<key>NSMessage</key>
			<string>runWorkflowAsService</string>
			<key>NSReturnTypes</key>
			<array>
				<string>public.utf8-plain-text</string>
			</array>
			<key>NSSendTypes</key>
			<array>
				<string>public.utf8-plain-text</string>
			</array>
		</dict>
	</array>
</dict>
</plist>`;
    writeFileSync(join(contentsDir, 'Info.plist'), infoPlistContent, 'utf8');

    // 2. Write Contents/document.wflow
    const commandScript = `TOKEN=$(cat ~/.zilmate-token 2>/dev/null || cat .zilmate-token 2>/dev/null)
INPUT_TEXT=$(cat)
RESPONSE=$(/usr/bin/curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{\\"text\\":\\"$INPUT_TEXT\\"}" http://127.0.0.1:8124/process)
/usr/bin/osascript -l JavaScript -e "function run(argv) { try { return JSON.parse(argv[0]).result || ''; } catch(e) { return 'Error: ' + e.message; } }" "$RESPONSE"`;

    const escapedScript = commandScript
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const documentWflowContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AMApplicationBuild</key>
	<string>523</string>
	<key>AMApplicationVersion</key>
	<string>2.10</string>
	<key>AMDocumentVersion</key>
	<string>2</string>
	<key>actions</key>
	<array>
		<dict>
			<key>action</key>
			<dict>
				<key>AMAccepts</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Optional</key>
					<true/>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
					</array>
				</dict>
				<key>AMActionVersion</key>
				<string>2.0.3</string>
				<key>AMApplication</key>
				<array>
					<string>Automator</string>
				</array>
				<key>AMBundleID</key>
				<string>com.apple.RunShellScript</string>
				<key>AMInitializationProvisioner</key>
				<string>customInit</string>
				<key>AMName</key>
				<string>Run Shell Script</string>
				<key>AMParameterProperties</key>
				<dict>
					<key>COMMAND_STRING</key>
					<dict/>
					<key>CheckedForUserDefaultShell</key>
					<dict/>
					<key>inputMethod</key>
					<dict/>
					<key>shell</key>
					<dict/>
					<key>source</key>
					<dict/>
				</dict>
				<key>AMProvides</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
					</array>
				</dict>
				<key>ActionBundlePath</key>
				<string>/System/Library/Automator/Run Shell Script.action</string>
				<key>ActionName</key>
				<string>Run Shell Script</string>
				<key>ActionParameters</key>
				<dict>
					<key>COMMAND_STRING</key>
					<string>${escapedScript}</string>
					<key>CheckedForUserDefaultShell</key>
					<true/>
					<key>inputMethod</key>
					<integer>0</integer>
					<key>shell</key>
					<string>/bin/zsh</string>
					<key>source</key>
					<string></string>
				</dict>
				<key>BundleIdentifier</key>
				<string>com.apple.RunShellScript</string>
				<key>CFBundleVersion</key>
				<string>2.0.3</string>
				<key>CanShowSelectedItemsWhenRun</key>
				<false/>
				<key>CanShowWhenRun</key>
				<true/>
				<key>Category</key>
				<array>
					<string>AMCategoryUtilities</string>
				</array>
				<key>Class Name</key>
				<string>RunShellScriptAction</string>
				<key>InputUUID</key>
				<string>F914DB64-0731-4F29-87DB-C559981B85FF</string>
				<key>Keywords</key>
				<array>
					<string>Shell</string>
					<string>Script</string>
					<string>Command</string>
					<string>Run</string>
					<string>Unix</string>
				</array>
				<key>OutputUUID</key>
				<string>98CCED4A-B6A0-449D-BB1A-D74EE8A7E004</string>
				<key>UUID</key>
				<string>C5177FA8-6D70-4E80-879E-158223EC9042</string>
				<key>UnlocalizedApplications</key>
				<array>
					<string>Automator</string>
				</array>
				<key>arguments</key>
				<dict>
					<key>0</key>
					<dict>
						<key>default value</key>
						<integer>0</integer>
						<key>name</key>
						<string>inputMethod</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>0</string>
					</dict>
					<key>1</key>
					<dict>
						<key>default value</key>
						<false/>
						<key>name</key>
						<string>CheckedForUserDefaultShell</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>1</string>
					</dict>
					<key>2</key>
					<dict>
						<key>default value</key>
						<string></string>
						<key>name</key>
						<string>source</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>2</string>
					</dict>
					<key>3</key>
					<dict>
						<key>default value</key>
						<string></string>
						<key>name</key>
						<string>COMMAND_STRING</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>3</string>
					</dict>
					<key>4</key>
					<dict>
						<key>default value</key>
						<string>/bin/sh</string>
						<key>name</key>
						<string>shell</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>4</string>
					</dict>
				</dict>
				<key>isViewVisible</key>
				<true/>
				<key>location</key>
				<string>309.000000:305.000000</string>
				<key>nibPath</key>
				<string>/System/Library/Automator/Run Shell Script.action/Contents/Resources/Base.lproj/main.nib</string>
			</dict>
			<key>isViewVisible</key>
			<true/>
		</dict>
	</array>
	<key>connectors</key>
	<dict/>
	<key>workflowMetaData</key>
	<dict>
		<key>serviceInputTypeIdentifier</key>
		<string>com.apple.Automator.text</string>
		<key>serviceOutputTypeIdentifier</key>
		<string>com.apple.Automator.text</string>
		<key>serviceProcessesInput</key>
		<integer>0</integer>
	</dict>
</dict>
</plist>`;
    writeFileSync(join(contentsDir, 'document.wflow'), documentWflowContent, 'utf8');

    console.log(theme.ok('✓ Programmatically created native macOS Quick Action service!'));

    // 3. Attempt programmatical key binding in pbs.plist
    try {
      const pbsPath = join(homedir(), 'Library', 'Preferences', 'pbs.plist');
      // Set key equivalent in pbs.plist for this service to CMD+Shift+Z ("@$z")
      execSync(`/usr/libexec/PlistBuddy -c "Add :NSServicesStatus:'com.apple.Automator.ZilMate Ubiquity':key_equivalent string '@\\$z'" "${pbsPath}" 2>/dev/null || /usr/libexec/PlistBuddy -c "Set :NSServicesStatus:'com.apple.Automator.ZilMate Ubiquity':key_equivalent string '@\\$z'" "${pbsPath}"`);
      const theDate = Date.now() / 1000;
      execSync(`defaults write com.apple.systempreferences NSServicesStatusModDate -float ${theDate}`);
      
      // Update pbs services database
      try {
        execSync('/System/Library/CoreServices/pbs -update', { stdio: 'ignore' });
      } catch {}
      console.log(theme.ok('✓ Automatically bound keyboard shortcut Cmd+Shift+Z to the Quick Action!'));
    } catch {
      // Quietly fall back, manual setting is printed as instruction anyway
    }

    printMacShortcutInstructions();
  } catch (error) {
    console.error(theme.error('Failed to create macOS Quick Action:'), error);
  }
}

export function printMacShortcutInstructions() {
  console.log('\n' + '='.repeat(60));
  console.log(theme.textBright('🍎 macOS global Hotkey (Cmd+Shift+Z) Verification 🍎'));
  console.log('='.repeat(60));
  console.log('ZilMate Ubiquity has been installed natively as a macOS Service Quick Action.');
  console.log('We have attempted to automatically bind it to your keyboard shortcut **Cmd+Shift+Z**.\n');
  
  console.log(`${theme.brand('How to Verify or Customize the Shortcut:')}`);
  console.log(`1. Open your Mac's **System Settings**.`);
  console.log(`2. Navigate to: **Keyboard** > **Keyboard Shortcuts** (button) > **Services** > **Text**.`);
  console.log(`3. Locate **"ZilMate Ubiquity"** in the list.`);
  console.log(`4. Verify it has **⌘⇧Z** assigned. If it's empty, double-click on the right side and press **Cmd+Shift+Z**.`);
  console.log(`5. Click **Done**.\n`);
  
  console.log(`${theme.brand('Usage:')}`);
  console.log(`- Select any text (e.g., "@zilmate rewrite: hello") in **any** app (WhatsApp, Slack, Safari, Notes, etc.).`);
  console.log(`- Press **Cmd + Shift + Z**.`);
  console.log(`- The text will automatically be sent, processed by ZilMate, and replaced in-place!`);
  console.log('='.repeat(60) + '\n');
}
