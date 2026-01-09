/**
 * shared/infra-shared/github-types.ts - Common GitHub type definitions
 *
 * Shared type definitions for GitHub API interactions.
 * Access: Action/Infra layers only.
 */

import type { GitHub } from '@actions/github/lib/utils.js';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';

/**
 * Octokit instance type.
 */
export type Octokit = InstanceType<typeof GitHub>;

/**
 * GitHub API Review type.
 */
export type Review = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][number];

/**
 * GitHub API Reviews array type.
 */
export type ReviewsArray = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'];
