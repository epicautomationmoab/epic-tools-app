export default function ExpAssessmentRetryIntro({count}:{count:number}) {
 const single=count===1;
 return <>
  <h3>Let’s Review {count} Safety {single?'Question':'Questions'}</h3>
  <p role="status">All 10 answers are recorded. {single?'One safety question needs':'These safety questions need'} a second look before your orientation is complete. Please review {single?'the question':'the questions'} one more time and choose the best {single?'response':'responses'}. Your video viewing and other answers are saved.</p>
 </>;
}
