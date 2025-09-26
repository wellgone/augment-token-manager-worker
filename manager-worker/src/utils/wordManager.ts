/**
 * Word Manager Utility
 * Manages English words for email generation
 * Filters words by length (3-6 letters) and provides random word selection
 */

import words from 'an-array-of-english-words';

/**
 * Cached filtered words to avoid repeated filtering
 */
let cachedWords: string[] | null = null;

/**
 * Filter words by length (3-6 letters) and cache the result
 * @returns Array of words with 3-6 letters
 */
function getFilteredWords(): string[] {
  if (cachedWords === null) {
    // Filter words: 3-6 letters, only alphabetic characters, no proper nouns
    cachedWords = words.filter(word => {
      // Check length
      if (word.length < 3 || word.length > 6) {
        return false;
      }
      
      // Check if word contains only lowercase letters (no proper nouns, no special chars)
      if (!/^[a-z]+$/.test(word)) {
        return false;
      }
      
      // Exclude very common but not meaningful words for email generation
      const excludeWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'men', 'put', 'say', 'she', 'too', 'use'];
      if (excludeWords.includes(word)) {
        return false;
      }
      
      return true;
    });
    
    console.log(`WordManager: Filtered ${cachedWords.length} words from ${words.length} total words`);
  }
  
  return cachedWords;
}

/**
 * Get a random word from the filtered word list
 * @returns A random word with 3-6 letters
 */
export function getRandomWord(): string {
  const filteredWords = getFilteredWords();
  
  if (filteredWords.length === 0) {
    // Fallback to a basic word list if filtering fails
    const fallbackWords = ['happy', 'lucky', 'smart', 'quick', 'bright', 'cool', 'fast', 'nice', 'super', 'magic'];
    return fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
  }
  
  return filteredWords[Math.floor(Math.random() * filteredWords.length)];
}

/**
 * Get two different random words
 * @returns Array of two different random words
 */
export function getTwoRandomWords(): [string, string] {
  const filteredWords = getFilteredWords();
  
  if (filteredWords.length < 2) {
    // Fallback if not enough words
    const fallbackWords = ['happy', 'lucky', 'smart', 'quick', 'bright', 'cool', 'fast', 'nice', 'super', 'magic'];
    const word1 = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
    let word2 = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
    
    // Ensure words are different
    while (word2 === word1) {
      word2 = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
    }
    
    return [word1, word2];
  }
  
  // Get first random word
  const word1 = filteredWords[Math.floor(Math.random() * filteredWords.length)];
  
  // Get second random word, ensuring it's different from the first
  let word2 = filteredWords[Math.floor(Math.random() * filteredWords.length)];
  let attempts = 0;
  while (word2 === word1 && attempts < 10) {
    word2 = filteredWords[Math.floor(Math.random() * filteredWords.length)];
    attempts++;
  }
  
  return [word1, word2];
}

/**
 * Generate a random number with 2-3 digits
 * @returns A random number between 10-999
 */
export function getRandomNumber(): number {
  // 70% chance for 3-digit number (100-999), 30% chance for 2-digit number (10-99)
  const useThreeDigits = Math.random() < 0.7;
  
  if (useThreeDigits) {
    return Math.floor(Math.random() * 900) + 100; // 100-999
  } else {
    return Math.floor(Math.random() * 90) + 10; // 10-99
  }
}

/**
 * Get statistics about the word manager
 * @returns Object containing word statistics
 */
export function getWordStats(): {
  totalWords: number;
  filteredWords: number;
  averageLength: number;
} {
  const filteredWords = getFilteredWords();
  const totalLength = filteredWords.reduce((sum, word) => sum + word.length, 0);
  
  return {
    totalWords: words.length,
    filteredWords: filteredWords.length,
    averageLength: filteredWords.length > 0 ? Math.round((totalLength / filteredWords.length) * 100) / 100 : 0
  };
}

/**
 * Clear the cached words (useful for testing or if word list needs to be refreshed)
 */
export function clearCache(): void {
  cachedWords = null;
}
