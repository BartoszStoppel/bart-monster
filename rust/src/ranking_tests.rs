use super::*;
use serde_json::json;

fn scope(metric: Metric) -> RankingScope {
    RankingScope {
        user_id: "01234567-89ab-cdef-0123-456789abcdef".into(),
        category: Category::Board,
        game_id: None,
        metric,
    }
}
fn row(id: &str, tier: &str, position: u32, score: f64) -> Placement {
    Placement {
        row_id: if id == "1" {
            "11111111-1111-1111-1111-111111111111"
        } else {
            "22222222-2222-2222-2222-222222222222"
        }
        .into(),
        id: id.into(),
        tier: tier.into(),
        position,
        score,
    }
}
fn allowed() -> HashSet<String> {
    ["1", "2", "3"].into_iter().map(str::to_owned).collect()
}

#[test]
fn score_rounding_matches_legacy_javascript_including_float_ties() {
    assert!(scores(0).is_empty());
    assert_eq!(scores(1), vec![10.0]);
    assert_eq!(scores(2), vec![10.0, 1.0]);
    assert_eq!(scores(3), vec![10.0, 5.5, 1.0]);
    assert_eq!(scores(5), vec![10.0, 7.8, 5.5, 3.3, 1.0]);
    assert_eq!(scores(21)[13], 4.1);
    assert_eq!(scores(61)[51], 2.4);
    for count in 2..1000 {
        let values = scores(count);
        assert_eq!(values[0], 10.0);
        assert_eq!(values[count - 1], 1.0);
        assert!(values.windows(2).all(|pair| pair[0] >= pair[1]));
    }
}

#[test]
fn revision_matches_existing_python_tokens() {
    let enjoyment = scope(Metric::Enjoyment);
    assert_eq!(
        revision(&[], &enjoyment).unwrap(),
        "d008369bfb39840f21188e55174f89b7cb103924f9abfd415f5adab2737143a3"
    );
    assert_eq!(
        revision(&[row("2", "F", 0, 1.0), row("1", "S", 0, 10.0)], &enjoyment).unwrap(),
        "ed07f3f0aafec192712a9df1c297e57416197da77668a2be9cf391305ea7e175"
    );
    assert_eq!(
        revision(
            &[row("2", "1", 0, 1.0), row("1", "6", 0, 6.0)],
            &scope(Metric::Difficulty)
        )
        .unwrap(),
        "783bbf5c0eff613279da903a7a22ff01edc53d3d9a4c45a1df27a8825388a634"
    );
    let expansion = RankingScope {
        category: Category::Party,
        game_id: Some(123),
        ..enjoyment
    };
    assert_eq!(
        revision(&[row("1", "S", 0, 10.0)], &expansion).unwrap(),
        "845c86dba8f0e1e514e296b910a52432dda939b59d7a22dc13f30cd63748bc08"
    );
}

#[test]
fn revision_is_bound_to_user_category_metric_and_parent() {
    let base = scope(Metric::Enjoyment);
    let cases = [
        base.clone(),
        RankingScope {
            user_id: "different".into(),
            ..base.clone()
        },
        RankingScope {
            category: Category::Party,
            ..base.clone()
        },
        RankingScope {
            metric: Metric::Difficulty,
            ..base.clone()
        },
        RankingScope {
            game_id: Some(1),
            ..base
        },
    ];
    let values: HashSet<_> = cases.iter().map(|s| revision(&[], s).unwrap()).collect();
    assert_eq!(values.len(), cases.len());
    assert_eq!(
        revision(
            &[],
            &RankingScope {
                game_id: Some(1),
                ..scope(Metric::Difficulty)
            }
        ),
        Err(RankingError::InvalidScope)
    );
}

#[test]
fn server_owns_scores_and_preserves_order_inside_each_tier() {
    let s = scope(Metric::Enjoyment);
    let revision = revision(&[], &s).unwrap();
    let plan = plan_save(
        &s,
        &[],
        &allowed(),
        &json!([{"id":1,"tier":"F","score":999},{"id":3,"tier":"S"},{"id":2,"tier":"S"}]),
        &revision,
    )
    .unwrap();
    assert!(!plan.unchanged);
    assert_eq!(
        plan.placements
            .iter()
            .map(|p| (p.id.as_str(), p.tier.as_str(), p.position, p.score))
            .collect::<Vec<_>>(),
        vec![("3", "S", 0, 10.0), ("2", "S", 1, 5.5), ("1", "F", 0, 1.0)]
    );
    assert_eq!(plan.score_changes.len(), 3);
}

#[test]
fn identical_retry_is_acknowledged_without_writes_even_with_stale_revision() {
    for (metric, tier, score) in [
        (Metric::Enjoyment, "S", 10.0),
        (Metric::Difficulty, "3", 3.0),
    ] {
        let s = scope(metric);
        let existing = [row("1", tier, 0, score)];
        let plan = plan_save(
            &s,
            &existing,
            &allowed(),
            &json!([{"id":1,"tier":tier,"score":999}]),
            "lost response",
        )
        .unwrap();
        assert!(plan.unchanged);
        assert!(plan.removed_ids.is_empty());
        assert!(plan.score_changes.is_empty());
        assert_eq!(plan.current_revision, revision(&existing, &s).unwrap());
        assert_eq!(plan.placements[0].score, score);
        assert_eq!(
            plan_save(&s, &existing, &allowed(), &json!([]), "stale").unwrap_err(),
            RankingError::Stale
        );
    }
}

#[test]
fn difficulty_is_fixed_and_same_tier_reordering_has_no_history_changes() {
    let s = scope(Metric::Difficulty);
    let existing = [row("1", "1", 0, 1.0), row("2", "1", 1, 1.0)];
    let current = revision(&existing, &s).unwrap();
    let plan = plan_save(
        &s,
        &existing,
        &allowed(),
        &json!([{"id":2,"tier":"1"},{"id":1,"tier":"1"}]),
        &current,
    )
    .unwrap();
    assert!(!plan.unchanged);
    assert!(plan.score_changes.is_empty());
    assert_eq!(
        plan.placements
            .iter()
            .map(|p| (p.id.as_str(), p.score, p.position))
            .collect::<Vec<_>>(),
        vec![("2", 1.0, 0), ("1", 1.0, 1)]
    );
    let plan = plan_save(
        &s,
        &existing,
        &allowed(),
        &json!([{"id":1,"tier":"1"},{"id":2,"tier":"1"},{"id":3,"tier":"6"}]),
        &current,
    )
    .unwrap();
    assert_eq!(
        plan.score_changes,
        vec![ScoreChange {
            id: "3".into(),
            before: None,
            after: Some(6.0)
        }]
    );
}

#[test]
fn score_changes_include_decreases_rescaling_and_unranking() {
    let s = scope(Metric::Enjoyment);
    let existing = [row("1", "S", 0, 10.0), row("2", "S", 1, 1.0)];
    let current = revision(&existing, &s).unwrap();
    let plan = plan_save(
        &s,
        &existing,
        &allowed(),
        &json!([{"id":2,"tier":"S"},{"id":1,"tier":"S"}]),
        &current,
    )
    .unwrap();
    assert_eq!(
        plan.score_changes[0],
        ScoreChange {
            id: "1".into(),
            before: Some(10.0),
            after: Some(1.0)
        }
    );
    assert_eq!(
        plan.score_changes[1],
        ScoreChange {
            id: "2".into(),
            before: Some(1.0),
            after: Some(10.0)
        }
    );
    let plan = plan_save(
        &s,
        &existing,
        &allowed(),
        &json!([{"id":2,"tier":"A"}]),
        &current,
    )
    .unwrap();
    assert_eq!(plan.removed_ids, vec!["1"]);
    assert_eq!(plan.score_changes[0].after, None);
    assert_eq!(plan.score_changes[1].after, Some(10.0));
}

#[test]
fn malformed_cross_scope_duplicate_and_unranked_entries_are_rejected() {
    let s = scope(Metric::Enjoyment);
    let current = revision(&[], &s).unwrap();
    for entries in [
        json!("bad"),
        json!({}),
        json!([null]),
        json!([{"id":10,"tier":"S"}]),
        json!([{"id":1,"tier":"S"},{"id":"1","tier":"A"}]),
        json!([{"id":1,"tier":"U"}]),
        json!([{"id":1,"tier":"SA"}]),
        json!([{"id":1,"tier":6}]),
        json!([{"id":true,"tier":"S"}]),
        json!([{"id":1.0,"tier":"S"}]),
    ] {
        assert!(
            plan_save(&s, &[], &allowed(), &entries, &current).is_err(),
            "{entries}"
        );
    }
    for tier in ["S", "0", "7", ""] {
        let s = scope(Metric::Difficulty);
        assert!(
            plan_save(
                &s,
                &[],
                &allowed(),
                &json!([{"id":1,"tier":tier}]),
                &revision(&[], &s).unwrap()
            )
            .is_err()
        );
    }
}

#[test]
fn expansion_validation_uses_only_the_parents_allowed_ids() {
    let s = RankingScope {
        game_id: Some(123),
        ..scope(Metric::Enjoyment)
    };
    let allowed = ["first-expansion".into(), "second-expansion".into()]
        .into_iter()
        .collect();
    let current = revision(&[], &s).unwrap();
    let plan = plan_save(
        &s,
        &[],
        &allowed,
        &json!([{"id":"second-expansion","tier":"F"},{"id":"first-expansion","tier":"S"}]),
        &current,
    )
    .unwrap();
    assert_eq!(
        plan.placements.iter().map(|p| p.score).collect::<Vec<_>>(),
        vec![10.0, 1.0]
    );
    assert!(
        plan_save(
            &s,
            &[],
            &allowed,
            &json!([{"id":"foreign-expansion","tier":"S"}]),
            &current
        )
        .is_err()
    );
}

#[test]
fn tied_positions_order_game_ids_numerically() {
    let rows = [row("10", "S", 0, 10.0), row("2", "S", 0, 1.0)];
    assert_eq!(
        ordered(&rows, &scope(Metric::Enjoyment))
            .unwrap()
            .iter()
            .map(|r| r.id.as_str())
            .collect::<Vec<_>>(),
        vec!["2", "10"]
    );
}

#[test]
fn metric_labels_and_history_reset_match_existing_behavior() {
    let options = tier_options(Metric::Difficulty);
    assert_eq!(
        options.iter().map(|o| o.label).collect::<Vec<_>>(),
        vec![
            "Monstrous",
            "Brutal",
            "Demanding",
            "Challenging",
            "Tame",
            "Cuddly",
            "Unranked"
        ]
    );
    assert_eq!(
        history_changes(&[Some(8.0), Some(6.0), None, Some(4.0), Some(5.0)]),
        vec![None, Some(-2.0), None, None, Some(1.0)]
    );
}

#[test]
fn shared_taste_distances_need_three_common_games() {
    assert_eq!(shared_distance(&[1, 2], &[1, 2], false), None);
    assert_eq!(shared_distance(&[1, 2, 3], &[1, 2, 3, 4], false), Some(0.0));
    assert_eq!(shared_distance(&[1, 2, 3, 4], &[1, 2, 3], true), Some(0.5));
    assert_eq!(shared_distance(&[1, 2, 3], &[3, 2, 1], false), Some(6.0));
}
