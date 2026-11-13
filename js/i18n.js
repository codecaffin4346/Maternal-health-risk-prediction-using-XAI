// Core assessment translations. Technical charts and PDF reports remain English.
export const messages = {
  en: {
    trimester: 'Gestational trimester', trimester1: 'Trimester 1 (Weeks 1–12)', trimester2: 'Trimester 2 (Weeks 13–26)', trimester3: 'Trimester 3 (Weeks 27–40)', sugarUnit: 'Blood sugar unit', tempUnit: 'Temperature unit', sampleHeader: 'Example readings (not your measurements):', lowSample: 'Low Risk example', midSample: 'Mid Risk example', highSample: 'High Risk example',
    language: 'Language / भाषा', assess: '🩺 Assessment', history: '📋 History',
    title: 'Understand your pregnancy health measurements',
    intro: 'Enter six measurements from a recent reading. You can use the full form or follow one step at a time.',
    formTitle: '🩺 Your measurements', formIntro: 'All six readings are needed. Do not guess a missing measurement.',
    start: '🩺 Start assessment', predict: '🔍 See my result', back: '← Edit readings', new: '+ New assessment',
    guided: 'Guide me step by step', full: 'Show full form', next: 'Next →', previous: '← Previous', unknown: 'I don’t know this reading',
    step: 'Step {step} of 6', unknownHelp: 'That is okay. Ask your care team to help you find this reading. The app cannot calculate a result without all six measurements. You can return to the full form at any time.',
    age: 'Age', sbp: 'Top blood pressure number (systolic)', dbp: 'Bottom blood pressure number (diastolic)',
    bs: 'Blood sugar', temp: 'Body temperature', hr: 'Heart rate', years: 'years',
    ageHelp: 'Enter your age in completed years.',
    sbpHelp: 'Use the top number on your blood pressure monitor or recent report. The unit is mmHg.',
    dbpHelp: 'Use the bottom number from the same blood pressure reading. The unit is mmHg.',
    bsHelp: 'Use your blood sugar report or meter. Match the unit on your report using the unit buttons above. If you do not have a reading, do not guess.',
    tempHelp: 'Use a thermometer reading. Select °C or °F above to match your thermometer.',
    hrHelp: 'Use a recent heart rate reading, in beats per minute (bpm).',
    missing: 'Enter {field}.', unsupported: '{field} is outside the model’s supported range. Check the value and selected unit. If the reading is correct, discuss it with your care team; do not change it to fit the app.',
    reversed: 'The top blood pressure number must be higher than the bottom number. Please check both readings.',
    measureHelp: 'Use recent measurements and check the unit beside each field. Values outside the supported range need review, not adjustment to fit this app.',
    disclaimer: 'Research prototype, not a diagnosis. Review results with your doctor or midwife. If you feel unwell, seek care even when the result says Low Risk.',
    scope: 'Hindi is available for the assessment steps and main result explanation. Detailed charts, technical information, history exports and PDF reports are in English.',
    low: 'Low Risk', mid: 'Mid Risk', high: 'High Risk', probability: '{value}% model probability', simulated: 'Simulation: ',
    uncertain: 'The model is uncertain between two categories', explain: 'How to read this prediction',
    uncertainty: '{first}: {p1}% of the model probability; {second}: {p2}%. These percentages describe model output, not your chance of a healthy or unhealthy pregnancy. Share your measurements with your care team. A Low Risk result does not rule out a problem.',
    close: 'The two leading categories are close. Avoid relying on the category alone. ',
    compareTitle: 'Compare with an earlier visit', compareLabel: 'Earlier assessment for the same person', chooseVisit: 'Choose an earlier assessment',
    compareEmpty: 'Compare assessments for the same person only. Complete another assessment to compare visits. History stays in this browser and is not backed up or synced.',
    compareSummary: 'Earlier prediction: {previous}. Current prediction: {current}. Measurement changes do not establish a change in clinical health. Values use mmol/L and °F. This compares saved readings, not simulator values.',
    measurement: 'Measurement', earlier: 'Earlier', current: 'Current', change: 'Change', caption: 'Saved measurements compared with this assessment',
    offlinePreparing: 'Preparing offline access…', offlineReady: 'Ready for offline use on this device', offlineActive: 'Offline — saved app is available',
    offlineUnavailable: 'Offline setup failed. Reconnect and reload to try again.', offlineUnsupported: 'Offline mode requires HTTPS or localhost and a supported browser.', offlineNotReady: 'Offline — preparation has not finished. Reconnect to prepare this device.',
    install: 'Install app', installHelp: 'To install, use your browser’s Install app or Add to Home Screen menu. Availability depends on your browser.',
    storage: 'Browser storage is unavailable. You can still assess, but history may be lost when you leave.',
    savedSample: 'Sample values loaded. They are examples, not your measurements.',
  },
  hi: {
    trimester: 'गर्भावस्था की तिमाही', trimester1: 'पहली तिमाही (सप्ताह 1–12)', trimester2: 'दूसरी तिमाही (सप्ताह 13–26)', trimester3: 'तीसरी तिमाही (सप्ताह 27–40)', sugarUnit: 'खून में शुगर की इकाई', tempUnit: 'तापमान की इकाई', sampleHeader: 'उदाहरण के माप (आपके व्यक्तिगत माप नहीं):', lowSample: 'कम जोखिम का उदाहरण', midSample: 'मध्यम जोखिम का उदाहरण', highSample: 'अधिक जोखिम का उदाहरण',
    language: 'Language / भाषा', assess: '🩺 आकलन', history: '📋 पिछले आकलन',
    title: 'गर्भावस्था में अपनी स्वास्थ्य जाँच के माप समझें',
    intro: 'हाल की जाँच के छह माप भरें। पूरा फ़ॉर्म भरें या एक-एक चरण में आगे बढ़ें।',
    formTitle: '🩺 आपके माप', formIntro: 'सभी छह माप ज़रूरी हैं। कोई माप पता न हो तो अनुमान न लगाएँ।',
    start: '🩺 आकलन शुरू करें', predict: '🔍 मेरा परिणाम देखें', back: '← माप बदलें', new: '+ नया आकलन',
    guided: 'एक-एक चरण में भरें', full: 'पूरा फ़ॉर्म दिखाएँ', next: 'अगला →', previous: '← पिछला', unknown: 'मुझे यह माप नहीं पता',
    step: 'चरण {step} / 6', unknownHelp: 'कोई बात नहीं। यह माप जानने के लिए अपनी स्वास्थ्य सेवा टीम से मदद लें। सभी छह माप के बिना ऐप परिणाम नहीं निकाल सकता। आप कभी भी पूरे फ़ॉर्म पर लौट सकते हैं।',
    age: 'उम्र', sbp: 'रक्तचाप की ऊपर वाली संख्या (सिस्टोलिक)', dbp: 'रक्तचाप की नीचे वाली संख्या (डायस्टोलिक)',
    bs: 'खून में शुगर', temp: 'शरीर का तापमान', hr: 'हृदय गति', years: 'वर्ष',
    ageHelp: 'अपनी उम्र पूरे हुए वर्षों में भरें।',
    sbpHelp: 'रक्तचाप की मशीन या हाल की रिपोर्ट में ऊपर वाली संख्या देखें। इसकी इकाई mmHg है।',
    dbpHelp: 'उसी रक्तचाप जाँच की नीचे वाली संख्या भरें। इसकी इकाई mmHg है।',
    bsHelp: 'अपनी शुगर रिपोर्ट या मीटर का माप भरें। ऊपर दिए बटन से रिपोर्ट वाली इकाई चुनें। माप न हो तो अनुमान न लगाएँ।',
    tempHelp: 'थर्मामीटर का माप भरें। ऊपर °C या °F में वही इकाई चुनें जो थर्मामीटर पर है।',
    hrHelp: 'हाल में मापी गई हृदय गति भरें। इसकी इकाई प्रति मिनट धड़कन (bpm) है।',
    missing: '{field} भरें।', unsupported: '{field} इस मॉडल की समर्थित सीमा के बाहर है। माप और चुनी हुई इकाई जाँचें। सही माप होने पर अपनी स्वास्थ्य सेवा टीम से बात करें; ऐप में भरने के लिए माप न बदलें।',
    reversed: 'रक्तचाप की ऊपर वाली संख्या नीचे वाली संख्या से बड़ी होनी चाहिए। दोनों माप जाँचें।',
    measureHelp: 'हाल के माप भरें और हर माप के पास दी गई इकाई जाँचें। समर्थित सीमा से बाहर के माप की समीक्षा ज़रूरी है; ऐप में भरने के लिए माप न बदलें।',
    disclaimer: 'यह शोध का शुरुआती ऐप है, निदान नहीं। परिणाम अपने डॉक्टर या दाई को दिखाएँ। अस्वस्थ महसूस होने पर कम जोखिम का परिणाम आने पर भी चिकित्सा सहायता लें।',
    scope: 'आकलन के चरण और मुख्य परिणाम की जानकारी हिंदी में उपलब्ध है। विस्तृत चार्ट, तकनीकी जानकारी, पिछले आकलन का निर्यात और PDF रिपोर्ट अंग्रेज़ी में हैं।',
    low: 'कम जोखिम', mid: 'मध्यम जोखिम', high: 'अधिक जोखिम', probability: '{value}% मॉडल संभावना', simulated: 'काल्पनिक बदलाव: ',
    uncertain: 'मॉडल दो श्रेणियों के बीच अनिश्चित है', explain: 'इस परिणाम को कैसे समझें',
    uncertainty: '{first}: मॉडल संभावना का {p1}%; {second}: {p2}%। ये प्रतिशत मॉडल के परिणाम बताते हैं, आपकी गर्भावस्था के स्वस्थ या अस्वस्थ होने की संभावना नहीं। अपने माप स्वास्थ्य सेवा टीम को दिखाएँ। कम जोखिम का परिणाम किसी समस्या को खारिज नहीं करता।',
    close: 'दोनों मुख्य श्रेणियों के परिणाम पास-पास हैं। केवल जोखिम की श्रेणी पर भरोसा न करें। ',
    compareTitle: 'पिछली जाँच से तुलना करें', compareLabel: 'इसी व्यक्ति का पिछला आकलन', chooseVisit: 'पिछला आकलन चुनें',
    compareEmpty: 'केवल एक ही व्यक्ति के आकलनों की तुलना करें। तुलना के लिए एक और आकलन पूरा करें। पिछले आकलन इसी ब्राउज़र में रहते हैं; उनका बैकअप या सिंक नहीं होता।',
    compareSummary: 'पिछला अनुमान: {previous}। वर्तमान अनुमान: {current}। माप में बदलाव से स्वास्थ्य में बदलाव साबित नहीं होता। इकाइयाँ mmol/L और °F हैं। यह सहेजे गए मापों की तुलना है, काल्पनिक बदलावों की नहीं।',
    measurement: 'माप', earlier: 'पिछला', current: 'वर्तमान', change: 'बदलाव', caption: 'सहेजे गए मापों की इस आकलन से तुलना',
    offlinePreparing: 'बिना इंटरनेट उपयोग की तैयारी हो रही है…', offlineReady: 'इस उपकरण पर बिना इंटरनेट उपयोग के लिए तैयार', offlineActive: 'इंटरनेट बंद है — सहेजा गया ऐप उपलब्ध है',
    offlineUnavailable: 'बिना इंटरनेट उपयोग की तैयारी नहीं हुई। इंटरनेट जोड़कर पेज दोबारा खोलें।', offlineUnsupported: 'बिना इंटरनेट उपयोग के लिए HTTPS या localhost और समर्थित ब्राउज़र चाहिए।', offlineNotReady: 'इंटरनेट बंद है — तैयारी अधूरी है। तैयारी के लिए इंटरनेट जोड़ें।',
    install: 'ऐप इंस्टॉल करें', installHelp: 'इंस्टॉल करने के लिए ब्राउज़र के Install app या Add to Home Screen विकल्प का उपयोग करें। उपलब्धता ब्राउज़र पर निर्भर करती है।',
    storage: 'ब्राउज़र में सहेजना उपलब्ध नहीं है। आप आकलन कर सकते हैं, लेकिन पेज छोड़ने पर पिछले आकलन खो सकते हैं।',
    savedSample: 'उदाहरण के माप भरे गए हैं। ये आपके व्यक्तिगत माप नहीं हैं।',
  },
};

let language = 'en';
export const getLanguage = () => language;
export function t(key, params = {}) {
  return (messages[language][key] ?? messages.en[key] ?? key)
    .replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
}
export function fieldName(index) { return t(['age','sbp','dbp','bs','temp','hr'][index]); }
export function riskName(index) { return t(['low','mid','high'][index]); }
export function errorMessage(error) {
  return t(error.code ?? 'unsupported', {field:fieldName(error.index)});
}
export function setLanguage(value) {
  language = value === 'hi' ? 'hi' : 'en';
  try { localStorage.setItem('mhr_language', language); } catch { /* Language still works for this visit. */ }
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-field-label]').forEach(el => { el.textContent = fieldName(Number(el.dataset.fieldLabel)); });
  ['age','sbp','dbp','bs','temp','hr'].forEach((id,i) => {
    for (const input of [document.getElementById(id), document.getElementById(id+'-slider')])
      input?.setAttribute('aria-label', fieldName(i));
  });
  document.getElementById('language-select').value = language;
  document.dispatchEvent(new CustomEvent('languagechange'));
}
export function initLanguage() {
  let saved;
  try { saved = localStorage.getItem('mhr_language'); } catch { /* Use browser language. */ }
  setLanguage(saved ?? (navigator.language?.startsWith('hi') ? 'hi' : 'en'));
  document.getElementById('language-select').addEventListener('change', event => setLanguage(event.target.value));
}
