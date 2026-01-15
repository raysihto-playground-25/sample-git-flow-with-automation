import type { GitHub } from '@actions/github/lib/utils.js';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';

export type Octokit = InstanceType<typeof GitHub>;

export type Review = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][number];
export type ReviewsArray = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'];

export interface PullRequestData {
  state: string;
  locked: boolean;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeableState: string;
  headSha: string;
  headRef: string;
  baseRef: string;
  author: string;
  isFork: boolean;
  title: string;
}
