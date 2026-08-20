/* node make-bookmarklet.js KPR27M2 twoj@mail.pl 5 > bookmarklet.txt */
const fs = require('fs');
const [plate = '', email = '', offset = '5'] = process.argv.slice(2);
const js = fs.readFileSync(__dirname + '/autofill.js', 'utf8');
const cfg = `window.SCT_CFG={plate:"${plate}",email:"${email}",offsetMin:${offset},price:"5",autoPay:true};window.__sctRunning=false;`;
process.stdout.write('javascript:' + encodeURIComponent(cfg + js + 'void 0;') + '\n');
