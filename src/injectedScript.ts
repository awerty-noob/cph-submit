// This script is injected into Codeforces submission page.
import { ContentScriptData } from './types';
import log from './log';

declare const browser: any;

if (typeof browser !== 'undefined') {
    self.chrome = browser;
}

log('cph-submit script injected');

const handleData = (data: ContentScriptData) => {
    log('Handling submit message');
    const languageEl = document.getElementsByName(
        'programTypeId',
    )[0] as HTMLSelectElement;
    const sourceCodeEl = document.getElementById(
        'sourceCodeTextarea',
    ) as HTMLTextAreaElement;

    sourceCodeEl.value = data.sourceCode;
    languageEl.value = data.languageId.toString();

    const problemIndexEl = document.getElementsByName(
        'submittedProblemIndex',
    )[0] as HTMLSelectElement | undefined;

    if (!problemIndexEl) {
        log('Problem index select not found');
        return;
    }

    const problemName = (data.url.split('/problem/')[1] ?? data.problemName).split('?')[0];
    problemIndexEl.value = problemName;

    const changeEvent = new Event('change', { bubbles: true });
    problemIndexEl.dispatchEvent(changeEvent);

    const problemCodeEl = document.getElementsByName(
        'submittedProblemCode',
    )[0] as HTMLInputElement | undefined;

    if (problemCodeEl) {
        try {
            const url = new URL(data.url);
            const segments = url.pathname.split('/').filter(Boolean);
            const problemSegmentIndex = segments.indexOf('problem');
            const problemIndexValue =
                problemSegmentIndex !== -1
                    ? segments[problemSegmentIndex + 1]
                    : undefined;
            const contestIdCandidate =
                problemSegmentIndex > 0 ? segments[problemSegmentIndex - 1] : undefined;

            if (contestIdCandidate && problemIndexValue) {
                problemCodeEl.value = `${contestIdCandidate}${problemIndexValue}`;
            }
        } catch (err) {
            log('Failed to set problem code', err);
        }
    }

    log('Submitting problem');
    const submitBtn = document.querySelector('.submit') as HTMLButtonElement;
    submitBtn.disabled = false;
    submitBtn.click();
};

log('Adding event listener', chrome);
chrome.runtime.onMessage.addListener((data: any, sender: any) => {
    log('Got message', data, sender);
    if (data.type == 'cph-submit') {
        handleData(data);
    }
});
