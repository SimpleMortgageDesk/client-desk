/* Macs with Apple chips refuse programs with no signature at all. This gives the Mac build a free "ad hoc" signature so it can be opened with right-click > Open. (A paid Apple Developer ID would remove the warning completely.) */
const { execFileSync } = require('child_process');
const path = require('path');
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'darwin') return;
  const app = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
