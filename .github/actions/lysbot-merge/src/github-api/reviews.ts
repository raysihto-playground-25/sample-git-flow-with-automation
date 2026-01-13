import type { Octokit, ReviewsArray } from '../types/index.js';

export async function fetchApprovedReviews(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReviewsArray> {
  const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return reviews.filter((review) => review.state === 'APPROVED');
}

export async function dismissReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  reviewId: number,
  message: string,
): Promise<boolean> {
  try {
    await octokit.rest.pulls.dismissReview({
      owner,
      repo,
      pull_number: prNumber,
      review_id: reviewId,
      message,
    });
    return true;
  } catch {
    return false;
  }
}
