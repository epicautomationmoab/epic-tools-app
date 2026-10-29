type PlacedForm={businessLine?:string|null;templateKey:string|null};
/** Tours retain their current presentation. Only these two rental forms float. */
export function isFloatingGuestForm(task:PlacedForm){
 return task.businessLine?.toLowerCase()!=="rental" || task.templateKey==="damage_acknowledgment" || task.templateKey==="pet_acknowledgment";
}
