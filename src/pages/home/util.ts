import { franc } from "franc-min";

const selectedTabKeyStorageKey = 'home-selected-tab-key';
const selectedFilterStorageKey = 'home-selected-filter';

export function updateLastSelectedTabKeyAndFilter(
  tabKey: string,
  filter: string,
) {
  localStorage.setItem(selectedTabKeyStorageKey, tabKey);
  localStorage.setItem(selectedFilterStorageKey, filter);
}

export function getLastSelectedTabKeyAndFilter() {
  const selectedTabKey = localStorage.getItem(selectedTabKeyStorageKey);
  const selectedFilter = localStorage.getItem(selectedFilterStorageKey);
  return { selectedFilter, selectedTabKey };
}

export function isChineseLang(text: string) {
  // Count the number of Kanji, Hiragana, and Katakana characters in the text
  const kanjiCount = (text.match(/[\u4e00-\u9faf]/g) || []).length;
  const hiraganaCount = (text.match(/[\u3040-\u309f]/g) || []).length;
  const katakanaCount = (text.match(/[\u30a0-\u30ff]/g) || []).length;

  // Check if the text has more Kanji, Hiragana, or Katakana characters
  if (kanjiCount > hiraganaCount && kanjiCount > katakanaCount) {
    return franc(text) === 'cmn' ? true : false;
  } else if (hiraganaCount > kanjiCount && hiraganaCount > katakanaCount) {
    return false; //"Japanese (Hiragana)";
  } else if (katakanaCount > kanjiCount && katakanaCount > hiraganaCount) {
    return false; //"Japanese (Katakana)";
  } else {
    return false; //"Uncertain";
  }
}
