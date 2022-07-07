import { Injectable } from "@angular/core";
import { AngularFirestore } from "@angular/fire/firestore";
import { from, Observable } from "rxjs";
import { concatMap, map } from "rxjs/operators";
import { Course } from "../model/course";
import { Lesson } from "../model/lesson";
import { convertSnaps } from "./db-utils";

@Injectable({
  providedIn: "root",
})
export class CoursesService {
  constructor(private db: AngularFirestore) {}

  loadCourseByCategory(category: string): Observable<Course[]> {
    return this.db
      .collection("courses", (ref) =>
        ref.where("categories", "array-contains", category)
      )
      .get()
      .pipe(map((result) => convertSnaps<Course>(result)));
  }

  createCourse(newCourse: Partial<Course>, courseId?: string) {
    return this.db
      .collection("courses", (ref) => ref.orderBy("seqNo", "desc").limit(1))
      .get()
      .pipe(
        concatMap((result) => {
          const courses = convertSnaps<Course>(result);
          const lastCourseSeqNo = courses[0]?.seqNo ?? 0;
          const course = {
            ...newCourse,
            seqNo: lastCourseSeqNo + 1,
          };
          let save$: Observable<any>;
          if (courseId) {
            save$ = from(this.db.doc(`courses/${courseId}`).set(course));
          } else {
            save$ = from(this.db.collection("courses").add(course));
          }
          return save$.pipe(
            map((res) => {
              return {
                id: courseId ?? res.id,
                ...course,
              };
            })
          );
        })
      );
  }

  updateCourse(courseId: string, changes: Partial<Course>): Observable<any> {
    return from(this.db.doc(`course/${courseId}`).update(changes));
  }

  deleteCourse(courseId: string) {
    return from(this.db.doc(`course/${courseId}`).delete());
  }

  deleteCourseAndLessons(courseId: string) {
    return this.db
      .collection(`courses/${courseId}/lessons`)
      .get()
      .pipe(
        concatMap((results) => {
          const lessons = convertSnaps<Lesson>(results);
          const batch = this.db.firestore.batch();
          const courseRef = this.db.doc(`courses/${courseId}`).ref;
          batch.delete(courseRef);
          for (let lesson of lessons) {
            const lessonRef = this.db.doc(
              `courses/${courseId}/lessons/${lesson.id}`
            ).ref;
            batch.delete(lessonRef);
          }
          return from(batch.commit());
        })
      );
  }
}
