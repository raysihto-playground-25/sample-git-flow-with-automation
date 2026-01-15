import { DefaultCommandParser, type CommandParser } from './command-parser.js';
import { DefaultMarkdownBuilder, type MarkdownBuilder } from './markdown-builder.js';
import { DefaultPrValidator, type PrValidator } from './pr-validator.js';

export interface ValidationModuleDeps {
  commandParser: CommandParser;
  prValidator: PrValidator;
  markdownBuilder: MarkdownBuilder;
}

export function configureValidationModule(): ValidationModuleDeps {
  const commandParser: CommandParser = new DefaultCommandParser();
  const prValidator: PrValidator = new DefaultPrValidator();
  const markdownBuilder: MarkdownBuilder = new DefaultMarkdownBuilder();

  return {
    commandParser,
    prValidator,
    markdownBuilder,
  };
}
