export default function ExpAssessmentRetryIntro({count}:{count:number}) {
 const single=count===1;
 return <>
  <h3>Let’s Review {count} Safety {single?'Question':'Questions'}</h3>
  <p role="status">You’ve finished all 10 questions. {single?'One safety question needs':'These safety questions need'} a second answer before your orientation is complete. Only {single?'that question is':'those questions are'} shown below. Your video viewing and other answers are saved.</p>
 </>;
}
