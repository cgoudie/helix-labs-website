/* eslint-disable class-methods-use-this */
// eslint-disable-next-line import/no-unresolved
import Tesseract from 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.esm.min.js';

import AbstractIdentity from '../abstractidentity.js';
import IdentityRegistry from '../identityregistry.js';
import SizeIdentity from './sizeidentity.js';

const concurrentOCR = 5;

const wordConfidenceThreshold = 85;
const exactTextMatchThresholdPercent = 0.2;

class TextIdentity extends AbstractIdentity {
  #text;

  #identityText;

  constructor(text, identityText) {
    super();
    this.#text = text;
    this.#identityText = identityText;
  }

  static async identifyPostflight(identityValues, identityState) {
    const { originatingClusterId, clusterManager } = identityValues;

    const { href } = identityValues.entryValues;

    const sizeIdentifier = clusterManager.get(originatingClusterId)
      .get(await SizeIdentity.getSizeId(href));
    if (sizeIdentifier?.tooBigForWeb) {
      // don't bother with large images.
      return;
    }

    const sloted = await this.#waitForOCRSlot(identityState);
    let text = '';
    let identityText = '';
    if (!sloted) {
      // eslint-disable-next-line no-console
      console.error(`Failed to get OCR slot for cluster ${originatingClusterId} Unable to process more OCR requests at this time.`);
    } else {
      identityState.currentlyTextIdentifyingCount += 1;

      try {
        // eslint-disable-next-line no-undef
        await Tesseract.recognize(
          clusterManager.get(originatingClusterId).elementForCluster,
          'eng',
        ).then(async ({ data: { words } }) => {
          // Filter words based on confidence level
          const confidentWords = words.filter((word) => word.confidence > wordConfidenceThreshold);

          if (confidentWords.length === 0) {
            return true;
          }
          text = confidentWords
            .map((word) => word.text.replace(/[^a-zA-Z0-9 ]/g, ''))
            .join(' ').replace(/\s+/g, ' ').trim();

          identityText = text.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
          return true;
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Error processing OCR for cluster ${originatingClusterId}`, error);
      } finally {
        identityState.currentlyTextIdentifyingCount -= 1;
      }
    }
    const identity = new TextIdentity(text, identityText);

    clusterManager.get(originatingClusterId).addIdentity(identity);
  }

  static async #waitForOCRSlot(identityState, maxAttempts = 6000, intervalMs = 100) {
    let attempts = 0;
    if (!identityState.currentlyTextIdentifyingCount) {
      identityState.currentlyTextIdentifyingCount = 0;
    }
    while (identityState.currentlyTextIdentifyingCount >= concurrentOCR) {
      if (attempts >= maxAttempts) {
        return false;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => { setTimeout(resolve, intervalMs); });
      attempts += 1;
    }
    return true;
  }

  static get type() {
    return 'text-identity';
  }

  static get uiSelectorProperties() {
    return {
      identity: TextIdentity.type,
      display: 'OCR Text',
      checked: false,
      hidden: false,
    };
  }

  get id() {
    return 'txt';
  }

  get strong() {
    return false;
  }

  get signleton() {
    return true;
  }

  get identityText() {
    return this.#identityText;
  }

  get text() {
    return this.#text;
  }

  decorateFigure(figureForCluster) {
    return figureForCluster;
  }

  mergeOther(otherIdentity) {
    if (otherIdentity.#text.length > this.#text.length) {
      // note: We'll presume if we're merging,
      // the higher word count is more accurate
      this.#text = otherIdentity.#text;
      this.#identityText = otherIdentity.#identityText;
    }
  }

  getMergeWeight(otherIdenty) {
    const {
      exactMatch,
      wordDifferencePercentage,
      bothSidesHadWords,
    } = this.compareWords(() => this.text, () => otherIdenty.text);

    if (!bothSidesHadWords) return 0;
    if (exactMatch) return 30;
    if (wordDifferencePercentage <= exactTextMatchThresholdPercent / 2) return 20;
    if (wordDifferencePercentage <= exactTextMatchThresholdPercent) return 10;
    if (wordDifferencePercentage <= exactTextMatchThresholdPercent * 2) return 5;
    return 0;
  }
}

IdentityRegistry.register(TextIdentity);
