/**
 * Script to generate Google Apps Script for creating a Checkbox Grid in Google Form.
 *
 * The form uses ONE Checkbox Grid question where:
 * - Rows    = characters (filtered by group)
 * - Columns = tier labels S / A / B / C / D
 *
 * Usage:
 * npm run scripts:generate-form-questions                   # epic (default)
 * npm run scripts:generate-form-questions -- --group epic
 * npm run scripts:generate-form-questions -- --group legendary
 * npm run scripts:generate-form-questions -- --group all
 *
 * Outputs:
 * - scripts/google-form-importer.gs (Google Apps Script)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

type CharacterGroup = 'legendary' | 'epic';

interface Character {
  id: string;
  name: string;
  element: string;
  rarity: number;
  /** Explicit group override (used for Travelers) */
  group?: CharacterGroup;
}

/** Derive group: explicit JSON field wins; fallback to rarity */
function getGroup(c: Character): CharacterGroup {
  if (c.group === 'epic' || c.group === 'legendary') return c.group;
  return c.rarity === 5 ? 'legendary' : 'epic';
}

function parseGroupArg(): CharacterGroup | 'all' {
  const idx = process.argv.indexOf('--group');
  if (idx !== -1 && process.argv[idx + 1]) {
    const val = process.argv[idx + 1].toLowerCase();
    if (val === 'legendary' || val === 'epic' || val === 'all') return val;
    console.error(`❌ Unknown --group value "${val}". Use: epic | legendary | all`);
    process.exit(1);
  }
  return 'epic'; // default
}

function generateFormQuestions() {
  try {
    const groupFilter = parseGroupArg();
    const charactersPath = join(process.cwd(), 'public', 'data', 'characters.json');
    const allCharacters: Character[] = JSON.parse(readFileSync(charactersPath, 'utf-8'));

    if (!allCharacters || allCharacters.length === 0) {
      console.error('❌ No characters found in characters.json');
      process.exit(1);
    }

    const characters =
      groupFilter === 'all'
        ? allCharacters
        : allCharacters.filter((c) => getGroup(c) === groupFilter);

    if (characters.length === 0) {
      console.error(`❌ No characters found for group "${groupFilter}"`);
      process.exit(1);
    }

    const gsScript = generateGoogleAppsScript(characters, groupFilter);
    const gsPath = join(process.cwd(), 'scripts', 'google-form-importer.gs');
    writeFileSync(gsPath, gsScript);

    console.log(`✅ Generated Checkbox Grid script for ${characters.length} characters (group: ${groupFilter})`);
    console.log(`📁 Output: ${gsPath}`);
    console.log(`\nWorkflow:`);
    console.log(`  1. Open your Google Form → Tools → Script editor`);
    console.log(`  2. Paste google-form-importer.gs`);
    console.log(`  3. Run clearAllQuestions()  — removes old questions`);
    console.log(`  4. Run addCheckboxGridToForm()  — adds the new grid`);
    console.log(`  5. Run exportFormMapping()  — logs JSON for form-character-mapping.json`);
    console.log(`  6. Copy JSON from Logger → public/form-character-mapping.json`);
  } catch (error) {
    console.error('❌ Error generating form questions:', error);
    process.exit(1);
  }
}

function generateGoogleAppsScript(characters: Character[], groupFilter: string): string {
  // Embed only what the GAS needs at runtime
  const charData = characters.map((c) => ({
    id: c.id,
    name: c.name,
    element: c.element,
    rarity: c.rarity,
  }));
  const charJson = JSON.stringify(charData);

  return `/**
 * Google Apps Script для Google Form — Tier List (Checkbox Grid)
 * АВТОМАТИЧЕСКИ СГЕНЕРИРОВАН — НЕ РЕДАКТИРУЙТЕ ВРУЧНУЮ
 * Пересгенерируйте: npm run scripts:generate-form-questions -- --group ${groupFilter}
 *
 * Группа персонажей: ${groupFilter} (${characters.length} персонажей)
 *
 * WORKFLOW:
 * 1. Откройте Google Form → три точки (⋮) → Редактор скриптов
 * 2. Вставьте весь код этого файла
 * 3. Запустите clearAllQuestions()    — удалит все старые вопросы
 * 4. Запустите addCheckboxGridToForm() — создаст Checkbox Grid с ${characters.length} строками
 * 5. Запустите exportFormMapping()     — выведет JSON для form-character-mapping.json
 * 6. Скопируйте JSON из логов → public/form-character-mapping.json
 */

// Данные персонажей (порядок должен совпадать с public/data/characters.json)
const CHARACTERS = ${charJson};
const TIERS = ['S', 'A', 'B', 'C', 'D'];

/** Уникальное название строки — учитывает 6 вариантов Путешественника */
function getRowLabel(char) {
  if (char.name === 'Traveler') {
    return 'Traveler (' + char.element.charAt(0).toUpperCase() + char.element.slice(1) + ')';
  }
  return char.name;
}

/**
 * Создаёт один Checkbox Grid в форме.
 * Строки = персонажи, столбцы = S / A / B / C / D.
 */
function addCheckboxGridToForm() {
  try {
    const form = FormApp.getActiveForm();
    const rows = CHARACTERS.map(getRowLabel);

    const grid = form.addGridItem();
    grid.setTitle('Tier List');
    grid.setColumns(TIERS);
    grid.setRows(rows);
    grid.setRequired(true);

    Logger.log('✅ Multiple Choice Grid создан: ' + rows.length + ' строк × ' + TIERS.length + ' столбцов');
    Logger.log('ℹ️  Запустите exportFormMapping() чтобы получить маппинг entry ID');
  } catch (error) {
    Logger.log('❌ Ошибка: ' + error);
  }
}

/**
 * Экспортирует маппинг character.id → entry.XXXXXXX из Multiple Choice Grid.
 *
 * GridItem не имеет getEntryIds(), поэтому парсим HTML формы через UrlFetchApp.
 * Для типа 7 (Multiple Choice Grid): q[4][0] = массив entry ID (по одному на строку).
 *
 * Скопируйте вывод JSON в: public/form-character-mapping.json
 */
function exportFormMapping() {
  try {
    const form = FormApp.getActiveForm();
    const formId = form.getId();

    // Fetch the published URL (need encoded form ID for pre-fill URLs)
    const publishedUrl = form.getPublishedUrl();
    const urlMatch = publishedUrl.match(/\\/e\\/([^\\/]+)\\//);
    const encodedFormId = urlMatch ? urlMatch[1] : formId;

    // Fetch form edit page — has complete data without lazy loading
    const editUrl = 'https://docs.google.com/forms/d/' + formId + '/edit';
    const html = UrlFetchApp.fetch(editUrl, { followRedirects: true }).getContentText();

    // Extract FB_PUBLIC_LOAD_DATA_ using bracket counting (regex can truncate large arrays)
    const varStart = html.indexOf('FB_PUBLIC_LOAD_DATA_ = [');
    if (varStart === -1) {
      Logger.log('❌ FB_PUBLIC_LOAD_DATA_ не найден в HTML.');
      return;
    }

    let depth = 0, i = varStart + 'FB_PUBLIC_LOAD_DATA_ = '.length, jsonStart = i;
    while (i < html.length) {
      if (html[i] === '[') depth++;
      else if (html[i] === ']') { depth--; if (depth === 0) { i++; break; } }
      else if (html[i] === '"') { i++; while (i < html.length && html[i] !== '"') { if (html[i] === '\\\\') i++; i++; } }
      i++;
    }
    const rawJson = html.substring(jsonStart, i);

    const data = JSON.parse(rawJson);
    const questions = data[1][1];

    Logger.log('🔍 Найдено вопросов: ' + questions.length);
    questions.forEach(function(q, idx) {
      if (q) Logger.log('  [' + idx + '] тип=' + q[3] + ' q[4][0].length=' + (Array.isArray(q[4] && q[4][0]) ? q[4][0].length : '?'));
    });

    // type 7 = Multiple Choice Grid; q[4][0] = array of entry IDs (one per row)
    const gridQ = questions.find(function(q) { return q && q[3] === 7; });
    if (!gridQ) {
      Logger.log('❌ Grid-вопрос (тип 7) не найден.');
      return;
    }

    const rows = gridQ[4]; // array of rows (one per character)
    Logger.log('✅ Строк найдено: ' + rows.length + ', ожидается: ' + CHARACTERS.length);

    if (rows.length !== CHARACTERS.length) {
      Logger.log('⚠️ Количество не совпадает. row[0] первой строки: ' + JSON.stringify(rows[0][0]));
    }

    const characterToEntry = {};
    CHARACTERS.forEach(function(char, idx) {
      if (idx < rows.length) {
        characterToEntry[char.id] = 'entry.' + rows[idx][0];
      }
    });

    const output = JSON.stringify({ formId: encodedFormId, characterToEntry: characterToEntry }, null, 2);
    Logger.log(output);
    Logger.log('✅ Скопируйте JSON выше в: public/form-character-mapping.json');
  } catch (error) {
    const msg = String(error);
    if (msg.indexOf('401') !== -1) {
      Logger.log('❌ Ошибка 401: форма не опубликована или недоступна.');
      Logger.log('   Откройте форму → Настройки → убедитесь что форма опубликована (не в черновике).');
    } else {
      Logger.log('❌ Ошибка: ' + error);
      Logger.log(error.stack);
    }
  }
}

/**
 * Удаляет все вопросы из формы (перед пересозданием).
 * ⚠️ ОСТОРОЖНО: удалит все данные вопросов!
 */
function clearAllQuestions() {
  try {
    const form = FormApp.getActiveForm();
    const items = form.getItems();
    Logger.log('⚠️  Удаляем ' + items.length + ' вопрос(ов)...');
    for (let i = items.length - 1; i >= 0; i--) {
      form.deleteItem(i);
    }
    Logger.log('✅ Все вопросы удалены');
  } catch (error) {
    Logger.log('❌ Ошибка: ' + error);
  }
}
`;
}

generateFormQuestions();
